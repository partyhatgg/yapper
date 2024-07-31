import type { APIMessage, GatewayMessageCreateDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { ButtonStyle, ComponentType, GatewayDispatchEvents, MessageFlags, RESTJSONErrorCodes } from "@discordjs/core";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";
import Functions, { TranscriptionModel } from "../../../lib/utilities/functions.js";
import { DiscordAPIError } from "@discordjs/rest";

export default class MessageCreate extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.MessageCreate);
	}

	/**
	 * Sent when a message is created. The inner payload is a message object with the following extra fields:
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#message-create
	 */
	public override async run({ shardId, data: message }: WithIntrinsicProps<GatewayMessageCreateDispatchData>) {
		if (message.author.bot) return;

		if (message.guild_id && (message.flags ?? 0) & MessageFlags.IsVoiceMessage) {
			const ignoredUser = await this.client.prisma.ignoredUser.findUnique({
				where: { userId: message.author.id },
			});

			if (ignoredUser && (ignoredUser.type === "ALL" || ignoredUser?.type === "AUTO_TRANSCRIPTION")) {
				return this.client.textCommandHandler.handleTextCommand({ data: message, shardId });
			}

			const autoTranscriptionsEnabled = await this.client.prisma.autoTranscriptVoiceMessages.findUnique({
				where: { guildId: message.guild_id },
			});

			if (!autoTranscriptionsEnabled) {
				return this.client.textCommandHandler.handleTextCommand({ data: message, shardId });
			}

			const attachment = message.attachments.find((attachment) =>
				this.client.config.allowedFileTypes.includes(attachment.content_type ?? ""),
			)!;

			let responseMessage: APIMessage;

			try {
				responseMessage = await this.client.api.channels.createMessage(message.channel_id, {
					content: ":writing_hand: Transcribing, this may take a moment...",
					message_reference: { message_id: message.id },
					allowed_mentions: { parse: [] },
				});
			} catch (error) {
				if (
					error instanceof DiscordAPIError &&
					error.code === RESTJSONErrorCodes.CannotReplyWithoutPermissionToReadMessageHistory
				) {
					responseMessage = await this.client.api.channels.createMessage(message.channel_id, {
						content: ":writing_hand: Transcribing, this may take a moment...",
						allowed_mentions: { parse: [] },
						components: [
							{
								components: [
									{
										type: ComponentType.Button,
										style: ButtonStyle.Link,
										url: `https://discord.com/channels/${message.guild_id ?? "@me"}/${message.channel_id}/${message.id}`,
										label: "Transcribed Message",
									},
								],
								type: ComponentType.ActionRow,
							},
						],
					});
				} else throw error;
			}

			const endpointHealth = await Functions.getEndpointHealth(TranscriptionModel.LARGEV3);

			let job;

			if (endpointHealth.workers.running <= 0) {
				job = await Functions.transcribeAudio(attachment.url, "run", TranscriptionModel.MEDIUM);
			} else {
				job = await Functions.transcribeAudio(attachment.url, "run", TranscriptionModel.LARGEV3);
			}

			return this.client.prisma.job.create({
				data: {
					id: job.id,
					attachmentUrl: attachment.url,
					model: endpointHealth.workers.running <= 0 ? TranscriptionModel.MEDIUM : TranscriptionModel.LARGEV3,
					channelId: message.channel_id,
					guildId: message.guild_id ?? "@me",
					initialMessageId: message.id,
					responseMessageId: responseMessage.id,
				},
			});
		}

		return this.client.textCommandHandler.handleTextCommand({ data: message, shardId });
	}
}
