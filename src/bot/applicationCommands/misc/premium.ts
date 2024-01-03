import type { APIApplicationCommandInteraction } from "@discordjs/core";
import { ApplicationCommandType, MessageFlags } from "@discordjs/core";
import ApplicationCommand from "../../../../lib/classes/ApplicationCommand.js";
import type Language from "../../../../lib/classes/Language.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";
import type { APIInteractionWithArguments } from "../../../../typings/index.js";

export default class Premium extends ApplicationCommand {
	/**
	 * Create our premium command.
	 *
	 * @param client - Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(client, {
			options: {
				...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
					name: "PREMIUM_COMMAND_NAME",
					description: "PREMIUM_COMMAND_DESCRIPTION",
				}),
				type: ApplicationCommandType.ChatInput,
			},
		});
	}

	/**
	 * Run this application command.
	 *
	 * @param options - The options for this command.
	 * @param options.shardId - The shard ID that this interaction was received on.
	 * @param options.language - The language to use when replying to the interaction.
	 * @param options.interaction -  The interaction to run this command on.
	 */
	public override async run({
		interaction,
	}: {
		interaction: APIInteractionWithArguments<APIApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}) {
		const premiumUser = await this.client.prisma.premiumUser.findUnique({
			include: { premiumGuilds: true },
			where: { userId: interaction.member!.user.id },
		});

		if (premiumUser) {
			if (premiumUser.premiumGuilds.length >= premiumUser.maxGuilds) {
				return this.client.api.interactions.reply(interaction.id, interaction.token, {
					content: "You've assigned your maximum amount of premium guilds already",
					allowed_mentions: { parse: [], replied_user: true },
					flags: MessageFlags.Ephemeral,
				});
			}

			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				content: "You are already premium!",
				allowed_mentions: { parse: [], replied_user: true },
				flags: MessageFlags.Ephemeral,
			});
		} else {
			const session = await this.client.stripe?.checkout.sessions.create({
				mode: "subscription",
				line_items: [
					{
						price: this.client.config.products[0]!.priceId,
						quantity: 1,
					},
				],
				metadata: {
					user_id: interaction.member!.user.id,
					guild_id: interaction.guild_id ?? null,
					max_guilds: this.client.config.products[0]!.maxGuilds,
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
}
