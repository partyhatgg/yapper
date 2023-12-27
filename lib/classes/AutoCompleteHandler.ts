import type {
	APIApplicationCommandAutocompleteInteraction,
	APIInteractionDataResolved,
	WithIntrinsicProps,
} from "@discordjs/core";
import { ApplicationCommandOptionType } from "@discordjs/core";
import type { APIInteractionWithArguments, InteractionArguments } from "../../typings";
import type ExtendedClient from "../extensions/ExtendedClient";
import applicationCommandOptionTypeReference from "../utilities/reference.js";
import type AutoComplete from "./AutoComplete";
import type Language from "./Language";

export default class AutoCompleteHandler {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * Create our auto complete handler.
	 *
	 * @param client Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		this.client = client;
	}

	/**
	 * Load all of the auto completes in the autoCompletes directory.
	 */
	public async loadAutoCompletes() {
		for (const parentFolder of this.client.functions.getFiles(
			`${this.client.__dirname}/dist/src/bot/autoCompletes`,
			"",
			true,
		))
			for (const fileName of this.client.functions.getFiles(
				`${this.client.__dirname}/dist/src/bot/autoCompletes/${parentFolder}`,
				".js",
			)) {
				const AutoCompleteFile = await import(`../../src/bot/autoCompletes/${parentFolder}/${fileName}`);

				const autoComplete = new AutoCompleteFile.default(this.client) as AutoComplete;

				this.client.autoCompletes.set(autoComplete.accepts, autoComplete);
			}
	}

	/**
	 * Reload all of the auto completes.
	 */
	public async reloadAutoCompletes() {
		this.client.autoCompletes.clear();
		await this.loadAutoCompletes();
	}

	/**
	 * Get an auto complete by its name.
	 *
	 * @param name The name of the auto complete.
	 * @returns The auto complete with the specified name within the accepts field, otherwise undefined.
	 */
	private getAutoComplete(name: string) {
		return [...this.client.autoCompletes.values()].find((autoComplete) => autoComplete.accepts.includes(name));
	}

	/**
	 * Handle an interaction properly to ensure that it can invoke an auto complete.
	 *
	 * @param options The options to handle the auto complete.
	 * @param options.data The interaction that is attempting to invoke an auto complete.
	 * @param options.shardId The shard ID to use when replying to the interaction.
	 */
	public async handleAutoComplete({
		data: interaction,
		shardId,
	}: Omit<WithIntrinsicProps<APIApplicationCommandAutocompleteInteraction>, "api">) {
		const name = [interaction.data.name];

		const applicationCommandArguments = {
			attachments: {},
			booleans: {},
			channels: {},
			integers: {},
			mentionables: {},
			numbers: {},
			roles: {},
			strings: {},
			users: {},
		} as InteractionArguments;

		let parentOptions = interaction.data.options ?? [];

		while (parentOptions.length) {
			const currentOption = parentOptions.pop();

			if (!currentOption) continue;

			if (currentOption.type === ApplicationCommandOptionType.SubcommandGroup) {
				name.push(currentOption.name);
				applicationCommandArguments.subCommandGroup = currentOption;
				parentOptions = currentOption.options;
			} else if (currentOption.type === ApplicationCommandOptionType.Subcommand) {
				name.push(currentOption.name);
				applicationCommandArguments.subCommand = currentOption;
				parentOptions = currentOption.options ?? [];
			} else {
				const identifier = applicationCommandOptionTypeReference[currentOption.type] as keyof Omit<
					InteractionArguments,
					"focused" | "subCommand" | "subCommandGroup"
				>;

				if (
					interaction.data.resolved &&
					identifier in interaction.data.resolved &&
					currentOption.name in interaction.data.resolved[identifier as keyof APIInteractionDataResolved]!
				) {
					applicationCommandArguments[identifier]![currentOption.name] = interaction.data.resolved[
						identifier as keyof APIInteractionDataResolved
					]![currentOption.name] as any;
					continue;
				}

				applicationCommandArguments[identifier]![currentOption.name] = currentOption as any;

				if ((applicationCommandArguments[identifier]![currentOption.name] as any).focused) {
					applicationCommandArguments.focused = currentOption as any;
					name.push(currentOption.name);
				}
			}
		}

		const interactionWithArguments = { ...interaction, arguments: applicationCommandArguments };

		const autoComplete = this.getAutoComplete(name.filter(Boolean).join("-"));
		if (!autoComplete) return;

		const userLanguage = await this.client.prisma.userLanguage.findUnique({
			where: { userId: (interaction.member?.user ?? interaction.user!).id },
		});
		const language = this.client.languageHandler.getLanguage(userLanguage?.languageId ?? interaction.locale);

		this.client.dataDog.increment("autocomplete_responses", 1, [`name:${name.join("-")}`, `shard:${shardId}`]);

		return this.runAutoComplete(autoComplete, interactionWithArguments, language, shardId);
	}

	/**
	 * Run an auto complete.
	 *
	 * @param autoComplete The auto complete we want to run.
	 * @param interaction The interaction that invoked the auto complete.
	 * @param language The language to use when replying to the interaction.
	 */
	private async runAutoComplete(
		autoComplete: AutoComplete,
		interaction: APIInteractionWithArguments<APIApplicationCommandAutocompleteInteraction>,
		language: Language,
		shardId: number,
	) {
		await autoComplete.run({ interaction, language, shardId }).catch(async (error) => {
			this.client.logger.error(error);

			await this.client.logger.sentry.captureWithInteraction(error, interaction);

			return this.client.api.interactions.createAutocompleteResponse(interaction.id, interaction.token, {
				choices: [],
			});
		});
	}
}
