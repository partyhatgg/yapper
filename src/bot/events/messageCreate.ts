import type { GatewayMessageCreateDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { GatewayDispatchEvents, MessageFlags } from "@discordjs/core";
import { InfrastructureUsed } from "@prisma/client";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";
import Functions from "../../../lib/utilities/functions.js";

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

			const responseMessage = await this.client.api.channels.createMessage(message.channel_id, {
				content: ":writing_hand: Transcribing, this may take a moment...",
				message_reference: { message_id: message.id },
				allowed_mentions: { parse: [] },
			});

			const endpointHealth = await Functions.getEndpointHealth();

			let job;

			if (endpointHealth.workers.running <= 0) {
				job = await Functions.transcribeAudio(attachment.url);
			} else {
				job = await Functions.transcribeAudioRunPod(attachment.url, "run", "large-v3");
			}

			return this.client.prisma.job.create({
				data: {
					id: job.id,
					attachmentUrl: attachment.url,
					infrastructureUsed: "transcription" in job ? InfrastructureUsed.CHATTER : InfrastructureUsed.SERVERLESS,
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
