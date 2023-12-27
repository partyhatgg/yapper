import type { GatewayGuildRoleDeleteDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { GatewayDispatchEvents } from "@discordjs/core";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";

export default class GuildRoleDelete extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.GuildRoleDelete, false);
	}

	/**
	 * Sent when a guild role is deleted.
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#guild-role-delete
	 */
	public override async run({ data }: WithIntrinsicProps<GatewayGuildRoleDeleteDispatchData>) {
		const previousGuildRoles = this.client.guildRolesCache.get(data.guild_id) ?? new Map();
		previousGuildRoles.delete(data.guild_id);

		this.client.guildRolesCache.set(data.guild_id, previousGuildRoles);
	}
}
