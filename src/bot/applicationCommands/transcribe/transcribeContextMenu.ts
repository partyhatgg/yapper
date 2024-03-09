import type { APIMessageApplicationCommandInteraction } from "@discordjs/core";
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
		const message = interaction.data.resolved.messages[interaction.data.target_id];

		const ignoredUser = await this.client.prisma.ignoredUser.findUnique({
			where: { userId: message!.author.id },
		});

		if (
			ignoredUser &&
			ignoredUser.userId !== (interaction.member?.user ?? interaction.user!).id &&
			(ignoredUser.type === "ALL" || ignoredUser?.type === "CONTEXT_MENU")
		)
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

		let attachmentUrl = message!.attachments.find((attachment) =>
			this.client.config.allowedFileTypes.includes(attachment.content_type ?? ""),
		)?.url;

		if (!attachmentUrl && message!.embeds?.[0]?.video?.url) {
			attachmentUrl = message!.embeds[0].video.url;
		}

		if (
			!attachmentUrl ||
			["https://www.tiktok.com", "https://www.youtube.com"].some((url) => attachmentUrl?.startsWith(url))
		)
			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				content: language.get("NO_VALID_ATTACHMENTS_ERROR"),
				allowed_mentions: { parse: [] },
				flags: MessageFlags.Ephemeral,
			});

		await this.client.api.interactions.reply(interaction.id, interaction.token, {
			content: language.get("TRANSCRIBING"),
			allowed_mentions: { parse: [] },
		});

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
