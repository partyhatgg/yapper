import type { APIApplicationCommandInteraction } from "@discordjs/core";
import { ApplicationCommandOptionType, ApplicationCommandType } from "@discordjs/core";
import type { IgnoreType } from "@prisma/client";
import ApplicationCommand from "../../../../lib/classes/ApplicationCommand.js";
import type Language from "../../../../lib/classes/Language.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";
import type { APIInteractionWithArguments } from "../../../../typings/index.js";

export default class Ignore extends ApplicationCommand {
	/**
	 * Create our ignore command.
	 *
	 * @param client - Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(client, {
			options: {
				...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
					name: "IGNORE_COMMAND_NAME",
					description: "IGNORE_COMMAND_DESCRIPTION",
				}),
				options: [
					{
						...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
							name: "IGNORE_COMMAND_CONTEXT_MENU_SUB_COMMAND_NAME",
							description: "IGNORE_COMMAND_CONTEXT_MENU_SUB_COMMAND_DESCRIPTION",
						}),
						type: ApplicationCommandOptionType.Subcommand,
					},
					{
						...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
							name: "IGNORE_COMMAND_AUTO_TRANSCRIPTION_SUB_COMMAND_NAME",
							description: "IGNORE_COMMAND_AUTO_TRANSCRIPTION_SUB_COMMAND_DESCRIPTION",
						}),
						type: ApplicationCommandOptionType.Subcommand,
					},
					{
						...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
							name: "IGNORE_COMMAND_ALL_SUB_COMMAND_NAME",
							description: "IGNORE_COMMAND_ALL_SUB_COMMAND_DESCRIPTION",
						}),
						type: ApplicationCommandOptionType.Subcommand,
					},
				],
				type: ApplicationCommandType.ChatInput,
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
		const isAlreadyBlocked = await this.client.prisma.ignoredUser.findUnique({
			where: {
				userId: (interaction.member?.user ?? interaction.user!).id!,
			},
		});

		if (isAlreadyBlocked && isAlreadyBlocked.type === interaction.arguments.subCommand!.name.toUpperCase())
			return Promise.all([
				this.client.prisma.ignoredUser.delete({
					where: {
						userId: (interaction.member?.user ?? interaction.user!).id!,
					},
				}),
				this.client.api.interactions.reply(interaction.id, interaction.token, {
					embeds: [
						{
							title: language.get("UNIGORED_SUCCESSFULLY_TITLE"),
							description: language.get("UNIGORED_SUCCESSFULLY_DESCRIPTION"),
							color: this.client.config.colors.success,
						},
					],
					allowed_mentions: { parse: [], replied_user: true },
				}),
			]);

		return Promise.all([
			this.client.prisma.ignoredUser.create({
				data: {
					userId: (interaction.member?.user ?? interaction.user!).id!,
					type: interaction.arguments.subCommand!.name.toUpperCase() as IgnoreType,
				},
			}),
			this.client.api.interactions.reply(interaction.id, interaction.token, {
				embeds: [
					{
						title: language.get("IGNORED_SUCCESSFULLY_TITLE"),
						description: language.get("IGNORED_SUCCESSFULLY_DESCRIPTION"),
						color: this.client.config.colors.success,
					},
				],
				allowed_mentions: { parse: [], replied_user: true },
			}),
		]);
	}
}
