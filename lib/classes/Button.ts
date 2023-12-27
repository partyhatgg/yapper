import type { APIEmbed, APIMessageComponentButtonInteraction, Permissions } from "@discordjs/core";
import { RESTJSONErrorCodes } from "@discordjs/core";
import { DiscordAPIError } from "@discordjs/rest";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import PermissionsBitField from "../utilities/permissions.js";
import type Language from "./Language.js";

export default class Button {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * The name of this button, we look for this at the start of each interaction.
	 *
	 * For example, if we have a button with the name addRole-1234567890, the button name
	 * should be addRole, as this will trigger the button no matter what role ID is provided.
	 */
	public readonly name: string;

	/**
	 * The permissions the user requires to run this button.
	 */
	public readonly permissions: Permissions;

	/**
	 * The permissions the client requires to run this button.
	 */
	public readonly clientPermissions: Permissions;

	/**
	 * Whether or not this button can only be run by developers.
	 */
	public readonly devOnly: boolean;

	/**
	 * Whether or not this application command can only be run by the guild owner.
	 */
	public readonly ownerOnly: boolean;

	/**
	 * Create a new button.
	 *
	 * @param client Our extended client.
	 * @param options The options for this button.
	 * @param options.clientPermissions The permissions the client requires to run this button.
	 * @param options.devOnly Whether or not this button can only be run by developers.
	 * @param options.name The name of this button, we look for this at the start of each interaction.
	 * @param options.ownerOnly Whether or not this button can only be run by the guild owner.
	 * @param options.permissions The permissions the user requires to run this button.
	 */
	public constructor(
		client: ExtendedClient,
		options: {
			clientPermissions?: Permissions;
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
		interaction: APIMessageComponentButtonInteraction;
		language: Language;
		shardId: number;
	}): Promise<APIEmbed | null> {
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

			if (guildOwnerId !== interaction.member!.user.id)
				return {
					title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
					description: language.get("MISSING_PERMISSIONS_OWNER_ONLY_DESCRIPTION", {
						type: "button",
					}),
				};
		} else if (this.devOnly && !this.client.config.admins.includes((interaction.member?.user ?? interaction.user!).id))
			return {
				title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
				description: language.get("MISSING_PERMISSIONS_DEVELOPER_ONLY_DESCRIPTION", {
					type: "button",
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

			return {
				title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
				description: language.get(
					missingPermissions.length === 1
						? "MISSING_PERMISSIONS_USER_PERMISSIONS_ONE_DESCRIPTION"
						: "MISSING_PERMISSIONS_USER_PERMISSIONS_OTHER_DESCRIPTION",
					{
						type: "button",
						missingPermissions: missingPermissions
							.map((missingPermission) => `**${language.get(missingPermission)}**`)
							.join(", "),
					},
				),
			};
		} else if (
			interaction.guild_id &&
			this.clientPermissions &&
			!PermissionsBitField.has(BigInt(interaction.app_permissions ?? 0), BigInt(this.clientPermissions))
		) {
			const missingPermissions = PermissionsBitField.toArray(
				PermissionsBitField.difference(BigInt(this.clientPermissions), BigInt(interaction.app_permissions ?? 0)),
			);

			return {
				title: language.get("MISSING_PERMISSIONS_BASE_TITLE"),
				description: language.get(
					missingPermissions.length === 1
						? "MISSING_PERMISSIONS_CLIENT_PERMISSIONS_ONE_DESCRIPTION"
						: "MISSING_PERMISSIONS_CLIENT_PERMISSIONS_OTHER_DESCRIPTION",
					{
						type: "button",
						missingPermissions: missingPermissions
							.map((missingPermissions) => `**${language.get(missingPermissions)}**`)
							.join(", "),
					},
				),
			};
		}

		return null;
	}

	/**
	 * Pre check the provided interaction after validating it.
	 *
	 * @param _options The options to pre-check.
	 * @param _options.interaction The interaction to pre-check.
	 * @param _options.language The language to use when replying to the interaction.
	 * @param _options.shardId The shard ID to use when replying to the interaction.
	 * @returns A tuple containing a boolean and an APIEmbed if the interaction is invalid, a boolean if the interaction is valid.
	 */
	public async preCheck(_options: {
		interaction: APIMessageComponentButtonInteraction;
		language: Language;
		shardId: number;
	}): Promise<[boolean, APIEmbed?]> {
		return [true];
	}

	/**
	 * Run this button.
	 *
	 * @param _options The options to run this button.
	 * @param _options.interaction The interaction that triggered this button.
	 * @param _options.language The language to use when replying to the interaction.
	 * @param _options.shardId The shard ID to use when replying to the interaction.
	 */
	public async run(_options: {
		interaction: APIMessageComponentButtonInteraction;
		language: Language;
		shardId: number;
	}): Promise<any> {}
}
