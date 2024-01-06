import type { APIApplicationCommandInteraction, APISelectMenuOption } from "@discordjs/core";
import { ApplicationCommandOptionType, ApplicationCommandType, ComponentType, MessageFlags } from "@discordjs/core";
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
				options: [
					{
						...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
							name: "PREMIUM_COMMAND_INFO_SUB_COMMAND_NAME",
							description: "PREMIUM_COMMAND_INFO_SUB_COMMAND_DESCRIPTION",
						}),
						type: ApplicationCommandOptionType.Subcommand,
					},
					{
						...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
							name: "PREMIUM_COMMAND_APPLY_SUB_COMMAND_NAME",
							description: "PREMIUM_COMMAND_APPLY_SUB_COMMAND_DESCRIPTION",
						}),
						type: ApplicationCommandOptionType.Subcommand,
					},
					{
						...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
							name: "PREMIUM_COMMAND_REMOVE_SUB_COMMAND_NAME",
							description: "PREMIUM_COMMAND_REMOVE_SUB_COMMAND_DESCRIPTION",
						}),
						type: ApplicationCommandOptionType.Subcommand,
						options: [
							{
								...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
									name: "PREMIUM_COMMAND_REMOVE_SUB_COMMAND_SERVER_OPTION_NAME",
									description: "PREMIUM_COMMAND_REMOVE_SUB_COMMAND_SERVER_OPTION_DESCRIPTION",
								}),
								type: ApplicationCommandOptionType.String,
							},
						],
					},
				],
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
		language,
	}: {
		interaction: APIInteractionWithArguments<APIApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}) {
		if (
			interaction.arguments.subCommand?.name ===
			this.client.languageHandler.defaultLanguage!.get("PREMIUM_COMMAND_INFO_SUB_COMMAND_NAME")
		) {
			const products = await this.client.stripe?.products.search({
				query: 'metadata["project"]:"yapper"',
				expand: ["total_count"],
			});

			if (!products?.total_count)
				return this.client.api.interactions.reply(interaction.id, interaction.token, {
					embeds: [
						{
							title: language.get("PREMIUM_INFO_NO_PRODUCTS_TITLE"),
							description: language.get("PREMIUM_INFO_NO_PRODUCTS_DESCRIPTION"),
							color: this.client.config.colors.error,
						},
					],
					flags: MessageFlags.Ephemeral,
				});

			const productsWithPrices = (
				await Promise.all(
					products.data
						.filter((product) => product.default_price)
						.map(async (product) => {
							if (!product.default_price) throw new Error(`Default price not found for product ${product.id}`);

							if (typeof product.default_price === "string") {
								const price = await this.client.stripe?.prices.retrieve(product.default_price);

								if (!price) throw new Error(`Fetched price not found for product ${product.id}`);

								return { ...product, price: price! };
							}

							return { ...product, price: product.default_price };
						}),
				)
			).filter((product) => product.price.billing_scheme === "per_unit");

			const premiumUser = await this.client.prisma.premiumUser.findUnique({
				include: { _count: { select: { premiumGuilds: true } } },
				where: { userId: (interaction.member?.user ?? interaction.user!).id },
			});

			let subscription;

			if (premiumUser?.subscriptionId) {
				subscription = await this.client.stripe?.subscriptions.retrieve(premiumUser.subscriptionId);
			}

			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				embeds: [
					{
						title: language.get("PREMIUM_INFO_TITLE"),
						description: language.get("PREMIUM_INFO_DESCRIPTION", {
							subscriptionInfo:
								premiumUser && subscription
									? language.get("SUBSCRIPTION_INFO", {
											appliedGuildCount: premiumUser._count.premiumGuilds,
											maxGuildCount: subscription.items.data[0]!.quantity,
											date: `<t:${subscription.current_period_end}:F>`,
									  })
									: "",
						}),
						color: this.client.config.colors.primary,
					},
				],
				components: productsWithPrices.length
					? [
							{
								components: [
									{
										type: ComponentType.StringSelect,
										custom_id: `premiumInfoProductSelect`,
										options: productsWithPrices.map((product) => ({
											label: product.name,
											default: Boolean(product.metadata.default),
											value: product.price.id,
											description: product.description
												? product.description.length > 50
													? product.description.slice(0, 47) + "..."
													: product.description
												: undefined,
											emoji: {
												name: product.metadata.emoji_name ?? "",
												id: product.metadata.emoji_id ?? "",
												animated: Boolean(product.metadata.emoji_animated),
											},
										})) as APISelectMenuOption[],
									},
								],
								type: ComponentType.ActionRow,
							},
					  ]
					: [],
			});
		}

		// const premiumUser = await this.client.prisma.premiumUser.findUnique({
		// 	include: { premiumGuilds: true },
		// 	where: { userId: interaction.member!.user.id },
		// });

		// if (premiumUser) {
		// 	if (premiumUser.premiumGuilds.length >= premiumUser.maxGuilds) {
		// 		return this.client.api.interactions.reply(interaction.id, interaction.token, {
		// 			content: "You've assigned your maximum amount of premium guilds already",
		// 			allowed_mentions: { parse: [], replied_user: true },
		// 			flags: MessageFlags.Ephemeral,
		// 		});
		// 	}

		// 	return this.client.api.interactions.reply(interaction.id, interaction.token, {
		// 		content: "You are already premium!",
		// 		allowed_mentions: { parse: [], replied_user: true },
		// 		flags: MessageFlags.Ephemeral,
		// 	});
		// } else {
		// 	const session = await this.client.stripe?.checkout.sessions.create({
		// 		mode: "subscription",
		// 		line_items: [
		// 			{
		// 				price: this.client.config.products[0]!.priceId,
		// 				quantity: 1,
		// 			},
		// 		],
		// 		metadata: {
		// 			user_id: interaction.member!.user.id,
		// 			guild_id: interaction.guild_id ?? null,
		// 			max_guilds: this.client.config.products[0]!.maxGuilds,
		// 		},
		// 		success_url: `https://partyhat.gg/billing/success?session_id={CHECKOUT_SESSION_ID}`,
		// 		cancel_url: `https://partyhat.gg/billing/cancel`,
		// 	});

		// 	return this.client.api.interactions.reply(interaction.id, interaction.token, {
		// 		content: `[Here's a link to purchase Yapper Premium!](${session?.url})`,
		// 		allowed_mentions: { parse: [], replied_user: true },
		// 		flags: MessageFlags.Ephemeral,
		// 	});
		// }
	}
}
