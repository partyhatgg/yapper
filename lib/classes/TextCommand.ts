import { env } from "node:process";
import type { APIEmbed, APIRole, GatewayMessageCreateDispatchData, Permissions } from "@discordjs/core";
import { RESTJSONErrorCodes } from "@discordjs/core";
import { DiscordAPIError } from "@discordjs/rest";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import PermissionsBitField from "../utilities/permissions.js";
import type Language from "./Language.js";

export default class TextCommand {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * The name for this application command.
	 */
	public readonly name: string;

	/**
	 * The permissions the user requires to run this application command.
	 */
	public readonly permissions: Permissions;

	/**
	 * The permissions the client requires to run this application command.
	 */
	public readonly clientPermissions: Permissions;

	/**
	 * Whether or not this application command can only be used by developers.
	 */
	public readonly devOnly: boolean;

	/**
	 * Whether or not this application command can only be run by the guild owner.
	 */
	public readonly ownerOnly: boolean;

	/**
	 * The cooldown on this application command.
	 */
	public readonly cooldown: number;

	/**
	 * Create a new text command.
	 *
	 * @param client Our extended client.
	 * @param options The options for this application command.
	 * @param options.name The name for this application command.
	 * @param options.description The description for this application command.
	 * @param options.clientPermissions The permissions the client requires to run this application command.
	 * @param options.cooldown The cooldown on this application command.
	 * @param options.devOnly Whether or not this application command can only be used by developers.
	 * @param options.ownerOnly Whether or not this application command can only be run by the guild owner.
	 * @param options.permissions The permissions the user requires to run this application command.
	 */
	public constructor(
		client: ExtendedClient,
		options: {
			clientPermissions?: Permissions;
			cooldown?: number;
			description?: string;
			devOnly?: boolean;
			name: string;
			ownerOnly?: boolean;
			permissions?: Permissions;
		},
	) {
		this.client = client;

		this.name = options.name;

		this.permissions = options.permissions ?? "0";
		this.clientPermissions = options.clientPermissions ?? "0";

		this.devOnly = options.devOnly ?? false;
		this.ownerOnly = options.ownerOnly ?? false;

		this.cooldown = options.cooldown ?? 0;
	}

	/**
	 * Apply a cooldown to a user.
	 *
	 * @param userId The userID to apply the cooldown on.
	 * @param cooldown The cooldown to apply, if not provided the default cooldown for this text command will be used.
	 * @returns True or False if the cooldown was applied.
	 */
	public async applyCooldown(userId: string, cooldown?: number) {
		if (this.cooldown) {
			const expiresAt = new Date(Date.now() + (cooldown ?? this.cooldown));

			return this.client.prisma.cooldown.upsert({
				where: {
					commandName_commandType_userId: {
						commandName: this.name,
						commandType: "TEXT_COMMAND",
						userId,
					},
				},
				update: {
					expiresAt,
				},
				create: {
					commandName: this.name,
					commandType: "TEXT_COMMAND",
					expiresAt,
					userId,
				},
			});
		}

		return false;
	}

	/**
	 * Validate that the message provided is valid.
	 *
	 * @param options The options to validate the message with.
	 * @param options.args The arguments to validate the message with.
	 * @param options.message The message to validate.
	 * @param options.language The language to use when replying to the message.
	 * @param options.shardId The shard ID to use when replying to the message.
	 * @returns An APIEmbed if the message is invalid, null if the message is valid.
	 */
	public async validate({
		message,
		language,
	}: {
		args: string[];
		language: Language;
		message: GatewayMessageCreateDispatchData;
		shardId: number;
	}): Promise<APIEmbed | null> {
		if (this.ownerOnly && message.guild_id) {
			if (!this.client.guildOwnersCache.has(message.guild_id))
				try {
					const guild = await this.client.api.guilds.get(message.guild_id);

					this.client.guildOwnersCache.set(message.guild_id, guild.owner_id);
				} catch (error) {
					if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownGuild) {
						const eventId = await this.client.logger.sentry.captureWithMessage(error, message);

						return {
							title: language.get("INTERNAL_ERROR_TITLE"),
							description: language.get("INTERNAL_ERROR_DESCRIPTION"),
							footer: {
								text: language.get("SENTRY_EVENT_ID_FOOTER", {
									eventId,
								}),
							},
						};
					}

					await this.client.logger.sentry.captureWithMessage(error, message);
					throw error;
				}

			const guildOwnerId = this.client.guildOwnersCache.get(message.guild_id);

			if (guildOwnerId !== message.author.id)
				return {
					title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
					description: language.get("MISSING_PERMISSIONS_OWNER_ONLY_DESCRIPTION", {
						type: "text command",
					}),
				};
		} else if (this.devOnly && !this.client.config.admins.includes(message.author.id))
			return {
				title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
				description: language.get("MISSING_PERMISSIONS_DEVELOPER_ONLY_DESCRIPTION", {
					type: "text command",
				}),
			};
		else if (message.guild_id && this.permissions !== "0") {
			if (!this.client.guildRolesCache.get(message.guild_id)) {
				const guildRoles = await this.client.api.guilds.getRoles(message.guild_id);
				const guildRolesMap = new Map<string, APIRole>();

				for (const role of guildRoles) guildRolesMap.set(role.id, role);

				this.client.guildRolesCache.set(message.guild_id, new Map(guildRolesMap));
			}

			const guildRoles = this.client.guildRolesCache.get(message.guild_id)!;

			if (!guildRoles)
				return {
					title: language.get("INTERNAL_ERROR_TITLE"),
					description: language.get("INTERNAL_ERROR_DESCRIPTION"),
				};

			const missingPermissions = PermissionsBitField.toArray(
				PermissionsBitField.difference(
					BigInt(this.permissions),
					PermissionsBitField.resolve(
						message
							.member!.roles.map((role) => guildRoles.get(role))
							.filter(Boolean)
							.map((role) => BigInt(role!.permissions)),
					),
				),
			);

			if (missingPermissions) {
				if (!this.client.guildOwnersCache.has(message.guild_id))
					try {
						const guild = await this.client.api.guilds.get(message.guild_id);

						this.client.guildOwnersCache.set(message.guild_id, guild.owner_id);
					} catch (error) {
						if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownGuild) {
							const eventId = await this.client.logger.sentry.captureWithMessage(error, message);

							return {
								title: language.get("INTERNAL_ERROR_TITLE"),
								description: language.get("INTERNAL_ERROR_DESCRIPTION"),
								footer: {
									text: language.get("SENTRY_EVENT_ID_FOOTER", {
										eventId,
									}),
								},
							};
						}

						await this.client.logger.sentry.captureWithMessage(error, message);
						throw error;
					}

				if (message.author.id !== this.client.guildOwnersCache.get(message.guild_id))
					return {
						title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
						description: language.get(
							missingPermissions.length === 1
								? "MISSING_PERMISSIONS_USER_PERMISSIONS_ONE_DESCRIPTION"
								: "MISSING_PERMISSIONS_USER_PERMISSIONS_OTHER_DESCRIPTION",
							{
								type: "text command",
								missingPermissions: missingPermissions
									.map((missingPermission) => `**${language.get(missingPermission)}**`)
									.join(", "),
							},
						),
					};
			}
		} else if (message.guild_id && this.clientPermissions !== "0") {
			let guildMe = this.client.guildMeCache.get(message.guild_id!);

			try {
				if (!guildMe) guildMe = await this.client.api.guilds.getMember(message.guild_id, env.APPLICATION_ID);

				if (!this.client.guildOwnersCache.has(message.guild_id)) {
					const guild = await this.client.api.guilds.get(message.guild_id);

					this.client.guildOwnersCache.set(message.guild_id, guild.owner_id);
				}
			} catch (error) {
				if (
					error instanceof DiscordAPIError &&
					([RESTJSONErrorCodes.UnknownMember, RESTJSONErrorCodes.UnknownGuild] as (number | string)[]).includes(
						error.code,
					)
				) {
					const eventId = await this.client.logger.sentry.captureWithMessage(error, message);

					return {
						title: language.get("INTERNAL_ERROR_TITLE"),
						description: language.get("INTERNAL_ERROR_DESCRIPTION"),
						footer: {
							text: language.get("SENTRY_EVENT_ID_FOOTER", {
								eventId,
							}),
						},
					};
				}

				throw error;
			}

			if (!this.client.guildRolesCache.get(message.guild_id)) {
				const guildRoles = await this.client.api.guilds.getRoles(message.guild_id);
				const guildRolesMap = new Map<string, APIRole>();

				for (const role of guildRoles) guildRolesMap.set(role.id, role);

				this.client.guildRolesCache.set(message.guild_id, new Map(guildRolesMap));
			}

			const guildRoles = this.client.guildRolesCache.get(message.guild_id)!;

			if (!guildRoles)
				return {
					title: language.get("INTERNAL_ERROR_TITLE"),
					description: language.get("INTERNAL_ERROR_DESCRIPTION"),
				};

			const missingPermissions = PermissionsBitField.toArray(
				PermissionsBitField.difference(
					BigInt(this.permissions),
					PermissionsBitField.resolve(
						guildMe.roles
							.map((role) => guildRoles.get(role))
							.filter(Boolean)
							.map((role) => BigInt(role!.permissions)),
					),
				),
			);

			if (missingPermissions && this.client.guildOwnersCache.get(message.guild_id) !== env.APPLICATION_ID)
				return {
					title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
					description: language.get(
						missingPermissions.length === 1
							? "MISSING_PERMISSIONS_CLIENT_PERMISSIONS_ONE_DESCRIPTION"
							: "MISSING_PERMISSIONS_CLIENT_PERMISSIONS_OTHER_DESCRIPTION",
						{
							type: "text command",
							missingPermissions: missingPermissions
								.map((missingPermission) => `**${language.get(missingPermission)}**`)
								.join(", "),
						},
					),
				};
		} else if (this.cooldown) {
			const cooldownItem = await this.client.prisma.cooldown.findUnique({
				where: {
					commandName_commandType_userId: {
						commandName: this.name,
						commandType: "APPLICATION_COMMAND",
						userId: message.author.id,
					},
				},
			});

			if (cooldownItem && Date.now() > cooldownItem.expiresAt.valueOf())
				return {
					title: language.get("TYPE_ON_COOLDOWN_TITLE"),
					description: language.get("TYPE_ON_COOLDOWN_DESCRIPTION", {
						type: "text command",
						formattedTime: this.client.functions.format(cooldownItem.expiresAt.valueOf() - Date.now(), true, language),
					}),
				};
		}

		return null;
	}

	/**
	 * Pre-check the provided message after validating it.
	 *
	 * @param _options The options to pre-check.
	 * @param _options.args The arguments to use when pre-checking the message.
	 * @param _options.message The message to pre-check.
	 * @param _options.language The language to use when replying to the message.
	 * @param _options.shardId The shard ID to use when replying to the message.
	 * @returns A tuple containing a boolean and an APIEmbed if the message is invalid, a boolean if the message is valid.
	 */
	public async preCheck(_options: {
		args: string[];
		language: Language;
		message: GatewayMessageCreateDispatchData;
		shardId: number;
	}): Promise<[boolean, APIEmbed?]> {
		return [true];
	}

	/**
	 * Run this text command.
	 *
	 * @param _options The options to run this text command.
	 * @param _options.args The arguments to use when running this text command.
	 * @param _options.message The message that triggered this text command.
	 * @param _options.language The language to use when replying to the message.
	 * @param _options.shardId The shard ID the message belongs to.
	 */
	public async run(_options: {
		args: string[];
		language: Language;
		message: GatewayMessageCreateDispatchData;
		shardId: number;
	}): Promise<any> {}
}
