import type { GatewayGuildRoleCreateDispatchData, WithIntrinsicProps } from "@discordjs/core";
import { GatewayDispatchEvents } from "@discordjs/core";
import EventHandler from "../../../lib/classes/EventHandler.js";
import type ExtendedClient from "../../../lib/extensions/ExtendedClient.js";

export default class GuildRoleCreate extends EventHandler {
	public constructor(client: ExtendedClient) {
		super(client, GatewayDispatchEvents.GuildRoleCreate, false);
	}

	/**
	 * Sent when a guild role is created.
	 *
	 * https://discord.com/developers/docs/topics/gateway-events#guild-role-create
	 */
	public override async run({ data }: WithIntrinsicProps<GatewayGuildRoleCreateDispatchData>) {
		const previousGuildRoles = this.client.guildRolesCache.get(data.guild_id) ?? new Map();
		previousGuildRoles.set(data.role.id, data.role);

		this.client.guildRolesCache.set(data.guild_id, previousGuildRoles);
	}
}
