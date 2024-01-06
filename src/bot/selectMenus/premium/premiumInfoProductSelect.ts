import { MessageFlags, type APIMessageComponentSelectMenuInteraction } from "@discordjs/core";
import type Language from "../../../../lib/classes/Language.js";
import SelectMenu from "../../../../lib/classes/SelectMenu.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";

export default class PremiumInfoProductSelect extends SelectMenu {
	/**
	 * Create our premium info product select menu command.
	 *
	 * @param client - Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(client, {
			name: "premiumInfoProductSelect",
		});
	}

	/**
	 * Run this select menu.
	 *
	 * @param options - The options for this command.
	 * @param options.shardId - The shard ID that this interaction was received on.
	 * @param options.language - The language to use when replying to the interaction.
	 * @param options.interaction -  The interaction to run this command on.
	 */
	public override async run({
		interaction,
	}: {
		interaction: APIMessageComponentSelectMenuInteraction;
		language: Language;
		shardId: number;
	}) {
		const priceId = interaction.data.values[0]!;

		const session = await this.client.stripe?.checkout.sessions.create({
			mode: "subscription",
			line_items: [
				{
					price: priceId!,
					quantity: 1,
				},
			],
			metadata: {
				user_id: interaction.member!.user.id,
				guild_id: interaction.guild_id ?? null,
			},
			success_url: `https://partyhat.gg/billing/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `https://partyhat.gg/billing/cancel`,
		});

		return this.client.api.interactions.reply(interaction.id, interaction.token, {
			content: `[Here's a link to purchase Yapper Premium!](${session?.url})`,
			allowed_mentions: { parse: [], replied_user: true },
			flags: MessageFlags.Ephemeral,
		});
	}
}
