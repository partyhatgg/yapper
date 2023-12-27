import type { APIApplicationCommandAutocompleteInteraction } from "@discordjs/core";
import type { APIInteractionWithArguments } from "../../typings";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import type Language from "./Language.js";

export default class AutoComplete {
	/**
	 * A list of strings that this autocomplete should listen to.
	 */
	public readonly accepts: string[];

	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * Create a new application command.
	 *
	 * @param accepts A list of strings that this autocomplete should listen to.
	 * @param client Our extended client.
	 */
	public constructor(accepts: string[], client: ExtendedClient) {
		this.accepts = accepts;
		this.client = client;
	}

	/**
	 * Run this auto complete.
	 *
	 * @param _options The options to run this application command.
	 * @param _options.interaction The interaction to pre-check.
	 * @param _options.language The language to use when replying to the interaction.
	 * @param _options.shardId The shard ID to use when replying to the interaction.
	 */
	public async run(_options: {
		interaction: APIInteractionWithArguments<APIApplicationCommandAutocompleteInteraction>;
		language: Language;
		shardId: number;
	}): Promise<any> {}
}
