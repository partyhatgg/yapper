import type { GatewayGuildDeleteDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { GatewayDispatchEvents } from "@discordjs/core";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";

export default class GuildDelete extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.GuildDelete, false);
	}

	/**
	 * Lazy-load for unavailable guild, guild became available, or user joined a new guild.
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#guild-delete
	 */
	public override async run({ shardId, data }: WithIntrinsicProps<GatewayGuildDeleteDispatchData>) {
		if (data.unavailable) return;

		this.client.dataDog?.increment("guild_count", -1, [`shard:${shardId}`]);

		this.client.guildRolesCache.delete(data.id);
		this.client.guildOwnersCache.delete(data.id);

		this.client.logger.info(
			`Left guild ${data.id} on Shard ${shardId}. Now at ${this.client.guildOwnersCache.size} guilds with ${this.client.approximateUserCount} total users.`,
		);

		return this.client.logger.webhookLog("guild", {
			content: `**__Left a Guild (${this.client.guildOwnersCache.size} Total)__**\n**Guild ID:** \`${
				data.id
			}\`\n**Timestamp:** ${this.client.functions.generateTimestamp()}\n**Shard ID:** \`${shardId}\``,
			username: `${this.client.config.botName} | Console Logs`,
			allowed_mentions: { parse: [] },
		});
	}
}
