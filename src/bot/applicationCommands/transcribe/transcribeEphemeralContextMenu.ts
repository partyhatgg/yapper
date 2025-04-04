import type { APIMessageApplicationCommandInteraction } from "@discordjs/core";
import { ApplicationCommandType, ApplicationIntegrationType } from "@discordjs/core";
import type Language from "../../../../lib/classes/Language.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";
import type { APIInteractionWithArguments } from "../../../../typings/index";
import { BaseTranscribeContextMenu } from "./transcribeContextMenu.js";

export default class TranscribeEphemeralContextMenu extends BaseTranscribeContextMenu {
	/**
	 * Create our transcribe context menu command.
	 *
	 * @param client - Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(client, {
			options: {
				...client.languageHandler.generateLocalizationsForApplicationCommandOptionTypeStringWithChoices({
					name: "TRANSCRIBE_EPHEMERAL_COMMAND_NAME",
				}),
				type: ApplicationCommandType.Message,
				integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
				contexts: [0, 1, 2],
			},
		});
	}

	public override async run({
		interaction,
		language,
		shardId,
	}: {
		interaction: APIInteractionWithArguments<APIMessageApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}) {
		return super.run({ interaction, language, shardId, ephemeral: true });
	}
}
