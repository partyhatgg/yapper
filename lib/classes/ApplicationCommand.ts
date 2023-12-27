import { env } from "node:process";
import type {
	APIApplicationCommandInteraction,
	APIContextMenuInteraction,
	APIEmbed,
	Permissions,
	RESTPostAPIApplicationCommandsJSONBody,
} from "@discordjs/core";
import { ApplicationCommandType, RESTJSONErrorCodes } from "@discordjs/core";
import { DiscordAPIError } from "@discordjs/rest";
import type { APIInteractionWithArguments } from "../../typings";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import PermissionsBitField from "../utilities/permissions.js";
import type Language from "./Language.js";

export default class ApplicationCommand {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * The name for this application command.
	 */
	public readonly name: string;

	/**
	 * The type of application command.
	 */
	public readonly type: ApplicationCommandType;

	/**
	 * The options for this application command.
	 */
	public readonly options: RESTPostAPIApplicationCommandsJSONBody;

	/**
	 * The permissions the user requires to run this application command.
	 */
	private readonly permissions: Permissions;

	/**
	 * The permissions the client requires to run this application command.
	 */
	private readonly clientPermissions: Permissions;

	/**
	 * Whether or not this application command can only be used by developers.
	 */
	private readonly devOnly: boolean;

	/**
	 * Whether or not this application command can only be run by the guild owner.
	 */
	private readonly ownerOnly: boolean;

	/**
	 * The cooldown on this application command.
	 */
	public readonly cooldown: number;

	/**
	 * The guilds this application command should be loaded into, if this value is defined, this command will only be added to these guilds and not globally.
	 */
	public readonly guilds: string[];

	/**
	 * Create a new application command.
	 *
	 * @param client Our extended client.
	 * @param options The options for this application command.
	 * @param options.clientPermissions The permissions the client requires to run this application command.
	 * @param options.cooldown The cooldown on this application command.
	 * @param options.devOnly Whether or not this application command can only be used by developers.
	 * @param options.guilds The guilds this application command should be loaded into, if this value is defined, this command will only be added to these guilds and not globally.
	 * @param options.options The options for this application command.
	 * @param options.ownerOnly Whether or not this application command can only be run by the guild owner.
	 */
	public constructor(
		client: ExtendedClient,
		options: {
			clientPermissions?: Permissions;
			cooldown?: number;
			devOnly?: boolean;
			guilds?: string[];
			options: RESTPostAPIApplicationCommandsJSONBody;
			ownerOnly?: boolean;
		},
	) {
		this.client = client;

		this.type = options.options.type!;
		this.options = options.options;
		this.name = options.options.name;

		this.permissions = options.options.default_member_permissions ?? "0";
		this.clientPermissions = options.clientPermissions ?? "0";

		this.devOnly = options.devOnly ?? false;
		this.ownerOnly = options.ownerOnly ?? false;

		this.cooldown = options.cooldown ?? 0;

		this.guilds = options.guilds ?? [];
	}

	/**
	 * Apply a cooldown to a user.
	 *
	 * @param userId The userID to apply the cooldown on.
	 * @param cooldown The cooldown to apply, if not provided the default cooldown for this application command will be used.
	 * @returns True or False if the cooldown was applied.
	 */
	public async applyCooldown(userId: string, cooldown?: number) {
		if (this.cooldown) {
			const expiresAt = new Date(Date.now() + (cooldown ?? this.cooldown));

			return Boolean(
				this.client.prisma.cooldown.upsert({
					where: {
						commandName_commandType_userId: {
							commandName: this.name,
							commandType: "APPLICATION_COMMAND",
							userId,
						},
					},
					update: {
						expiresAt,
					},
					create: {
						commandName: this.name,
						commandType: "APPLICATION_COMMAND",
						expiresAt,
						userId,
					},
				}),
			);
		}

		return false;
	}

	/**
	 * Validate that the interaction provided is valid.
	 *
	 * @param options The options for this function.
	 * @param options.interaction The interaction to validate.
	 * @param options.language The language to use when replying to the interaction.
	 * @param options.shardId The shard ID to use when replying to the interaction.
	 * @returns An APIEmbed if the interaction is invalid, null if the interaction is valid.
	 */
	public async validate({
		interaction,
		language,
	}: {
		interaction: APIInteractionWithArguments<APIApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}): Promise<APIEmbed | null> {
		const type = this.type === ApplicationCommandType.ChatInput ? "slash command" : "context menu";

		if (this.ownerOnly && interaction.guild_id) {
			if (!this.client.guildOwnersCache.has(interaction.guild_id))
				try {
					const guild = await this.client.api.guilds.get(interaction.guild_id);

					this.client.guildOwnersCache.set(interaction.guild_id, guild.owner_id);
				} catch (error) {
					if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownGuild) {
						const eventId = await this.client.logger.sentry.captureWithInteraction(error, interaction);

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

					await this.client.logger.sentry.captureWithInteraction(error, interaction);
					throw error;
				}

			const guildOwnerId = this.client.guildOwnersCache.get(interaction.guild_id);

			if (guildOwnerId !== (interaction.member?.user ?? interaction.user!).id)
				return {
					title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
					description: language.get("MISSING_PERMISSIONS_OWNER_ONLY_DESCRIPTION", {
						type,
					}),
				};
		} else if (
			this.devOnly &&
			!this.client.config.admins.includes((interaction.member?.user ?? interaction.user!).id || "")
		)
			return {
				title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
				description: language.get("MISSING_PERMISSIONS_DEVELOPER_ONLY_DESCRIPTION", {
					type,
				}),
			};
		else if (
			interaction.guild_id &&
			this.permissions !== "0" &&
			!PermissionsBitField.has(BigInt(interaction.member?.permissions ?? 0), BigInt(this.permissions))
		) {
			const missingPermissions = PermissionsBitField.toArray(
				PermissionsBitField.difference(BigInt(this.permissions), BigInt(interaction.member?.permissions ?? 0)),
			);

			if (missingPermissions) {
				if (!this.client.guildOwnersCache.has(interaction.guild_id))
					try {
						const guild = await this.client.api.guilds.get(interaction.guild_id);

						this.client.guildOwnersCache.set(interaction.guild_id, guild.owner_id);
					} catch (error) {
						if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownGuild) {
							const eventId = await this.client.logger.sentry.captureWithInteraction(error, interaction);

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

						await this.client.logger.sentry.captureWithInteraction(error, interaction);
						throw error;
					}

				if (
					(interaction.member?.user ?? interaction.user!).id !== this.client.guildOwnersCache.get(interaction.guild_id)
				)
					return {
						title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
						description: language.get(
							missingPermissions.length === 1
								? "MISSING_PERMISSIONS_USER_PERMISSIONS_ONE_DESCRIPTION"
								: "MISSING_PERMISSIONS_USER_PERMISSIONS_OTHER_DESCRIPTION",
							{
								type,
								missingPermissions: missingPermissions
									.map((missingPermission) => `**${language.get(missingPermission)}**`)
									.join(", "),
							},
						),
					};
			}
		} else if (
			interaction.guild_id &&
			this.clientPermissions &&
			!PermissionsBitField.has(BigInt(interaction.app_permissions ?? 0), BigInt(this.clientPermissions))
		) {
			const missingPermissions = PermissionsBitField.toArray(
				PermissionsBitField.difference(BigInt(this.clientPermissions), BigInt(interaction.app_permissions ?? 0)),
			);

			if (missingPermissions) {
				let guildMe = this.client.guildMeCache.get(interaction.guild_id!);

				try {
					if (!guildMe) guildMe = await this.client.api.guilds.getMember(interaction.guild_id, env.APPLICATION_ID);

					if (!this.client.guildOwnersCache.has(interaction.guild_id)) {
						const guild = await this.client.api.guilds.get(interaction.guild_id);

						this.client.guildOwnersCache.set(interaction.guild_id, guild.owner_id);
					}
				} catch (error) {
					if (
						error instanceof DiscordAPIError &&
						([RESTJSONErrorCodes.UnknownMember, RESTJSONErrorCodes.UnknownGuild] as (number | string)[]).includes(
							error.code,
						)
					) {
						const eventId = await this.client.logger.sentry.captureWithInteraction(error, interaction);

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

				if (this.client.guildOwnersCache.get(interaction.guild_id) !== env.APPLICATION_ID)
					return {
						title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
						description: language.get(
							missingPermissions.length === 1
								? "MISSING_PERMISSIONS_CLIENT_PERMISSIONS_ONE_DESCRIPTION"
								: "MISSING_PERMISSIONS_CLIENT_PERMISSIONS_OTHER_DESCRIPTION",
							{
								type,
								missingPermissions: missingPermissions
									.map((missingPermission) => `**${language.get(missingPermission)}**`)
									.join(", "),
							},
						),
					};
			}
		} else if (this.cooldown) {
			const cooldownItem = await this.client.prisma.cooldown.findUnique({
				where: {
					commandName_commandType_userId: {
						commandName: this.name,
						commandType: "APPLICATION_COMMAND",
						userId: (interaction.member?.user ?? interaction.user!).id,
					},
				},
			});

			if (cooldownItem && Date.now() > cooldownItem.expiresAt.valueOf())
				return {
					title: language.get("TYPE_ON_COOLDOWN_TITLE"),
					description: language.get("TYPE_ON_COOLDOWN_DESCRIPTION", {
						type,
						formattedTime: this.client.functions.format(cooldownItem.expiresAt.valueOf() - Date.now(), true, language),
					}),
				};
		}

		return null;
	}

	/**
	 * Pre-check the provided interaction after validating it.
	 *
	 * @param _options The options to pre-check.
	 * @param _options.interaction The interaction to pre-check.
	 * @param _options.language The language to use when replying to the interaction.
	 * @param _options.shardId The shard ID to use when replying to the interaction.
	 * @returns A tuple containing a boolean and an APIEmbed if the interaction is invalid, a boolean if the interaction is valid.
	 */
	public async preCheck(_options: {
		interaction: APIInteractionWithArguments<APIApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}): Promise<[boolean, APIEmbed?]> {
		return [true];
	}

	/**
	 * Run this application command.
	 *
	 * @param _options The options to run this application command.
	 * @param _options.interaction The interaction that triggered this application command.
	 * @param _options.language The language to use when replying to the interaction.
	 * @param _options.shardId The shard ID the interaction belongs to.
	 */
	public async run(_options: {
		interaction: APIInteractionWithArguments<APIApplicationCommandInteraction | APIContextMenuInteraction>;
		language: Language;
		shardId: number;
	}): Promise<any> {}
}
