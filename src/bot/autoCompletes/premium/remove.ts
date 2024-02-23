import type { APIApplicationCommandAutocompleteInteraction } from "@discordjs/core";
import AutoComplete from "../../../../lib/classes/AutoComplete.js";
import type Language from "../../../../lib/classes/Language.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";
import type { APIInteractionWithArguments } from "../../../../typings/index.js";

export default class PremiumRemoveServer extends AutoComplete {
	/**
	 * Create our premium remove server auto complete.
	 *
	 * @param client - Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(["premium-remove-server"], client);
	}

	/**
	 * Run this auto complete.
	 *
	 * @param options - The options for this auto complete.
	 * @param options.shardId - The shard ID that this interaction was received on.
	 * @param options.language - The language to use when replying to the interaction.
	 * @param options.interaction - The interaction to run this auto complete on.
	 */
	public override async run({
		interaction,
	}: {
		interaction: APIInteractionWithArguments<APIApplicationCommandAutocompleteInteraction>;
		language: Language;
		shardId: number;
	}) {
		const premiumGuilds = await this.client.prisma.premiumGuild.findMany({
			where: { purchaserId: (interaction.member?.user ?? interaction.user!).id },
		});

		const guilds = await Promise.all(premiumGuilds.map(async ({ guildId }) => this.client.api.guilds.get(guildId)));

		return this.client.api.interactions.createAutocompleteResponse(interaction.id, interaction.token, {
			choices: guilds.map((guild) => ({
				name: guild.name,
				value: guild.id,
			})),
		});
	}
}
