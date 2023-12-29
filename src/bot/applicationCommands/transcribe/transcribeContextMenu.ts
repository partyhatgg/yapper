import type { APIEmbed, APIMessageApplicationCommandInteraction } from "@discordjs/core";
import { ApplicationCommandType, ButtonStyle, ComponentType, MessageFlags } from "@discordjs/core";
import { InfrastructureUsed } from "@prisma/client";
import ApplicationCommand from "../../../../lib/classes/ApplicationCommand.js";
import type Language from "../../../../lib/classes/Language.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";
import Functions from "../../../../lib/utilities/functions.js";
import type { APIInteractionWithArguments } from "../../../../typings/index.js";

export default class TranscribeContextMenu extends ApplicationCommand {
	/**
	 * Create our transcribe context menu command.
	 *
	 * @param client - Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(client, {
			options: {
				...client.languageHandler.generateLocalizationsForApplicationCommandOptionTypeStringWithChoices({
					name: "TRANSCRIBE_COMMAND_NAME",
				}),
				type: ApplicationCommandType.Message,
			},
		});
	}

	/**
	 * Pre-check the provided interaction after validating it.
	 *
	 * @param options The options to pre-check.
	 * @param options.interaction The interaction to pre-check.
	 * @param options.language The language to use when replying to the interaction.
	 * @param options.shardId The shard ID to use when replying to the interaction.
	 * @returns A tuple containing a boolean and an APIEmbed if the interaction is invalid, a boolean if the interaction is valid.
	 */
	public override async preCheck({
		interaction,
		language,
	}: {
		interaction: APIInteractionWithArguments<APIMessageApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}): Promise<[boolean, APIEmbed?]> {
		const premiumGuild = await this.client.prisma.premiumGuild.findUnique({
			where: { guildId: interaction.guild_id! },
			include: { purchaser: true },
		});

		if ((premiumGuild?.purchaser.expiresAt.getTime() ?? 0) < Date.now())
			return [
				false,
				{
					title: language.get("NOT_A_PREMIUM_GUILD_ERROR_TITLE"),
					description: language.get("NOT_A_PREMIUM_GUILD_FILES_ERROR_DESCRIPTION"),
				},
			];

		return [true];
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
		interaction: APIInteractionWithArguments<APIMessageApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}) {
		if (
			interaction.data.resolved.messages[interaction.data.target_id]?.attachments.every(
				(attachment) => !this.client.config.allowedFileTypes.includes(attachment.content_type ?? ""),
			)
		)
			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				content: language.get("NO_VALID_ATTACHMENTS_ERROR"),
				allowed_mentions: { parse: [] },
				flags: MessageFlags.Ephemeral,
			});

		const ignoredUser = await this.client.prisma.ignoredUser.findUnique({
			where: { userId: interaction.data.resolved.messages[interaction.data.target_id]!.author.id },
		});

		if (ignoredUser)
			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				content: language.get("USER_IS_IGNORED_ERROR"),
				flags: MessageFlags.Ephemeral,
				allowed_mentions: { parse: [] },
			});

		const [existingTranscription, jobExists] = await Promise.all([
			this.client.prisma.transcription.findUnique({
				where: {
					initialMessageId: interaction.data.target_id,
				},
			}),
			this.client.prisma.job.findFirst({
				where: {
					initialMessageId: interaction.data.target_id,
					guildId: interaction.guild_id!,
				},
			}),
		]);

		if (existingTranscription) {
			const message = await this.client.api.channels.getMessage(
				interaction.channel.id,
				existingTranscription.responseMessageId,
			);

			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				content: message.content,
				flags: MessageFlags.Ephemeral,
				components: [
					{
						components: [
							{
								type: ComponentType.Button,
								style: ButtonStyle.Link,
								url: existingTranscription.threadId
									? `https://discord.com/channels/${interaction.guild_id}/${existingTranscription.threadId}`
									: `https://discord.com/channels/${interaction.guild_id}/${interaction.channel.id}/${existingTranscription.initialMessageId}`,
								label: existingTranscription.threadId
									? language.get("READ_MORE_BUTTON_LABEL")
									: language.get("TRANSCRIBED_MESSAGE_BUTTON_LABEL"),
							},
						],
						type: ComponentType.ActionRow,
					},
				],
				allowed_mentions: { parse: [] },
			});
		} else if (jobExists) {
			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				content: language.get("MESSAGE_STILL_BEING_TRANSCRIBED_ERROR"),
				flags: MessageFlags.Ephemeral,
				allowed_mentions: { parse: [] },
			});
		}

		await this.client.api.interactions.reply(interaction.id, interaction.token, {
			content: language.get("TRANSCRIBING"),
			allowed_mentions: { parse: [] },
		});

		const attachmentUrl = interaction.data.resolved.messages[interaction.data.target_id]!.attachments.find(
			(attachment) => this.client.config.allowedFileTypes.includes(attachment.content_type ?? ""),
		)!.url;

		const [job, reply] = await Promise.all([
			Functions.transcribeAudio(attachmentUrl, "endpoint", "run", "base"),
			this.client.api.interactions.getOriginalReply(interaction.application_id, interaction.token),
		]);

		return this.client.prisma.job.create({
			data: {
				id: job.id,
				infrastructureUsed: InfrastructureUsed.ENDPOINT,
				attachmentUrl,
				channelId: interaction.channel.id,
				guildId: interaction.guild_id!,
				interactionId: interaction.id,
				interactionToken: interaction.token,
				initialMessageId: interaction.data.target_id,
				responseMessageId: reply.id,
			},
		});
	}
}
