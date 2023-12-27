import type { GatewayGuildRoleUpdateDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { GatewayDispatchEvents } from "@discordjs/core";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";

export default class GuildRoleUpdate extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.GuildRoleUpdate, false);
	}

	/**
	 * Sent when a guild role is updated.
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#guild-role-update
	 */
	public override async run({ data }: WithIntrinsicProps<GatewayGuildRoleUpdateDispatchData>) {
		const previousGuildRoles = this.client.guildRolesCache.get(data.guild_id) ?? new Map();
		previousGuildRoles.set(data.guild_id, data.role);

		this.client.guildRolesCache.set(data.guild_id, previousGuildRoles);
	}
}
