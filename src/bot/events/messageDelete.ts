import type { GatewayMessageDeleteDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { GatewayDispatchEvents } from "@discordjs/core";
import { InfrastructureUsed } from "@prisma/client";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";

export default class MessageDelete extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.MessageDelete);
	}

	/**
	 * Sent when a message is deleted.
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#message-delete
	 */
	public override async run({ data: message }: WithIntrinsicProps<GatewayMessageDeleteDispatchData>) {
		const [transcription, job] = await Promise.all([
			this.client.prisma.transcription.findUnique({
				where: { initialMessageId: message.id },
			}),
			this.client.prisma.job.findFirst({
				where: { initialMessageId: message.id },
			}),
		]);

		if (job) {
			return Promise.all([
				job.infrastructureUsed === InfrastructureUsed.SERVERLESS && this.client.functions.cancelJob(job.id),
				this.client.prisma.job.delete({ where: { id: job.id } }),
				this.client.api.channels.deleteMessage(message.channel_id, job.responseMessageId),
			]);
		}

		if (transcription) {
			return Promise.all([
				this.client.prisma.transcription.delete({ where: { initialMessageId: message.id } }),
				this.client.api.channels.deleteMessage(message.channel_id, transcription.responseMessageId),
				transcription?.threadId ? this.client.api.channels.delete(transcription.threadId) : null,
			]);
		}
	}
}
