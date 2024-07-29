import type { GatewayGuildCreateDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { GatewayDispatchEvents } from "@discordjs/core";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";

export default class GuildCreate extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.GuildCreate, false);
	}

	/**
	 * Lazy-load for unavailable guild, guild became available, or user joined a new guild.
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#guild-create
	 */
	public override async run({ shardId, data }: WithIntrinsicProps<GatewayGuildCreateDispatchData>) {
		const guildRoles = new Map();

		for (const guildRole of data.roles) guildRoles.set(guildRole.id, guildRole);

		this.client.guildRolesCache.set(data.id, guildRoles);
		if (this.client.guildOwnersCache.get(data.id) === undefined) {
			this.client.guildOwnersCache.set(data.id, data.owner_id);
			this.client.approximateUserCount += data.member_count;

			this.client.logger.info(
				`Joined ${data.name} [${data.id}] with ${data.member_count} members on Shard ${shardId}. Now at ${this.client.guildOwnersCache.size} guilds with ${this.client.approximateUserCount} total users.`,
			);

			return this.client.logger.webhookLog("guild", {
				content: `**__Joined a New Guild (${this.client.guildOwnersCache.size} Total)__**\n**Guild Name:** \`${
					data.name
				}\`\n**Guild ID:** \`${data.id}\`\n**Guild Owner:** <@${data.owner_id}> \`[${
					data.owner_id
				}]\`\n**Guild Member Count:** \`${
					data.member_count
				}\`\n**Timestamp:** ${this.client.functions.generateTimestamp()}\n**Shard ID:** \`${shardId}\``,
				username: `${this.client.config.botName} | Console Logs`,
				allowed_mentions: { parse: [] },
			});
		}

		if (this.client.guildOwnersCache.get(data.id) !== data.owner_id) {
			return this.client.guildOwnersCache.set(data.id, data.owner_id);
		}

		return true;
	}
}
