import type { APIApplicationCommandInteraction } from "@discordjs/core";
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	InteractionContextType,
	PermissionFlagsBits,
} from "@discordjs/core";
import ApplicationCommand from "../../../../lib/classes/ApplicationCommand.js";
import type Language from "../../../../lib/classes/Language.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";
import type { APIInteractionWithArguments } from "../../../../typings/index.js";

export default class Config extends ApplicationCommand {
	/**
	 * Create our config command.
	 *
	 * @param client - Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(client, {
			options: {
				...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
					name: "CONFIG_COMMAND_NAME",
					description: "CONFIG_COMMAND_DESCRIPTION",
				}),
				options: [
					{
						...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
							name: "CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_NAME",
							description: "CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_DESCRIPTION",
						}),
						options: [
							{
								...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
									name: "CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_ENABLE_SUB_COMMAND_NAME",
									description:
										"CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_ENABLE_SUB_COMMAND_DESCRIPTION",
								}),
								type: ApplicationCommandOptionType.Subcommand,
							},
							{
								...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
									name: "CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_DISABLE_SUB_COMMAND_NAME",
									description:
										"CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_DISABLE_SUB_COMMAND_DESCRIPTION",
								}),
								type: ApplicationCommandOptionType.Subcommand,
							},
						],
						type: ApplicationCommandOptionType.SubcommandGroup,
					},
				],
				default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
				type: ApplicationCommandType.ChatInput,
				contexts: [InteractionContextType.Guild],
			},
		});
	}

	/**
	 * Run this application command.
	 *
	 * @param options - The options for this command.
	 * @param options.shardId - The shard ID that this interaction was received on.
	 * @param options.language - The language to use when replying to the interaction.
	 * @param options.interaction -  The interaction to run this command on.
	 */
	public override async run({
		interaction,
		language,
	}: {
		interaction: APIInteractionWithArguments<APIApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}) {
		if (
			interaction.arguments.subCommandGroup!.name ===
			this.client.languageHandler.defaultLanguage!.get(
				"CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_NAME",
			)
		) {
			if (
				interaction.arguments.subCommand!.name ===
				this.client.languageHandler.defaultLanguage!.get(
					"CONFIG_COMMAND_AUTO_TRANSCRIPT_VOICE_MESSAGES_SUB_COMMAND_GROUP_ENABLE_SUB_COMMAND_NAME",
				)
			)
				return Promise.all([
					this.client.prisma.autoTranscriptVoiceMessages.upsert({
						where: { guildId: interaction.guild_id! },
						create: { guildId: interaction.guild_id! },
						update: {},
					}),
					this.client.api.interactions.reply(interaction.id, interaction.token, {
						embeds: [
							{
								title: language.get("AUTO_TRANSCRIPT_VOICE_MESSAGES_ENABLED_TITLE"),
								description: language.get("AUTO_TRANSCRIPT_VOICE_MESSAGES_ENABLED_DESCRIPTION"),
								color: this.client.config.colors.success,
							},
						],
						allowed_mentions: { parse: [] },
					}),
				]);

			return Promise.all([
				this.client.prisma.autoTranscriptVoiceMessages.deleteMany({
					where: { guildId: interaction.guild_id! },
				}),
				this.client.api.interactions.reply(interaction.id, interaction.token, {
					embeds: [
						{
							title: language.get("AUTO_TRANSCRIPT_VOICE_MESSAGES_DISABLED_TITLE"),
							description: language.get("AUTO_TRANSCRIPT_VOICE_MESSAGES_DISABLED_DESCRIPTION"),
							color: this.client.config.colors.success,
						},
					],
					allowed_mentions: { parse: [] },
				}),
			]);
		}

		return "";
	}
}
