import type { GatewayReadyDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { GatewayDispatchEvents } from "@discordjs/core";
import { setInterval } from "node:timers";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";
import {
	approximateUserCountGauge,
	guildCountGauge,
	guildGauge,
	userInstallationGauge,
} from "../../../lib/utilities/metrics.js";

export default class Ready extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.Ready, true);
	}

	/**
	 * Contains the initial state information.
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#ready
	 */
	public override async run({ shardId, data }: WithIntrinsicProps<GatewayReadyDispatchData>) {
		guildCountGauge.record(data.guilds.length, {
			shard: shardId,
		});

		for (const guild of data.guilds) this.client.guildOwnersCache.set(guild.id, "");

		const me = await this.client.api.applications.getCurrent();

		userInstallationGauge.record((me as any).approximate_user_install_count);

		this.client.logger.info(
			`Logged in as ${data.user.username}#${data.user.discriminator} [${data.user.id}] on Shard ${shardId} with ${data.guilds.length} guilds and ${(me as any).approximate_user_install_count} user installations.`,
		);

		setInterval(() => {
			guildGauge.record(this.client.guildOwnersCache.size);
			approximateUserCountGauge.record(this.client.approximateUserCount);
		}, 10_000);

		return this.client.logger.webhookLog("console", {
			content: `${this.client.functions.generateTimestamp()} Logged in as ${data.user.username}#${
				data.user.discriminator
			} [\`${data.user.id}\`] on Shard ${shardId} with ${data.guilds.length} guilds and ${(me as any).approximate_user_install_count} user installations.`,
			allowed_mentions: { parse: [] },
			username: `${this.client.config.botName} | Console Logs`,
		});
	}
}
