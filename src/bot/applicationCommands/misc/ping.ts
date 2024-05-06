import type { APIApplicationCommandInteraction } from "@discordjs/core";
import { ApplicationCommandType, MessageFlags } from "@discordjs/core";
import { DiscordSnowflake } from "@sapphire/snowflake";
import ApplicationCommand from "../../../../lib/classes/ApplicationCommand.js";
import type Language from "../../../../lib/classes/Language.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";
import type { APIInteractionWithArguments } from "../../../../typings/index.js";

export default class Ping extends ApplicationCommand {
	/**
	 * Create our ping command.
	 *
	 * @param client - Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(client, {
			options: {
				...client.languageHandler.generateLocalizationsForApplicationCommandOptionType({
					name: "PING_COMMAND_NAME",
					description: "PING_COMMAND_DESCRIPTION",
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
		language,
	}: {
		interaction: APIInteractionWithArguments<APIApplicationCommandInteraction>;
		language: Language;
		shardId: number;
	}) {
		await this.client.api.interactions.reply(interaction.id, interaction.token, {
			content: language.get("PING"),
			allowed_mentions: { parse: [], replied_user: true },
			flags: MessageFlags.Ephemeral,
		});

		const message = await this.client.api.interactions.getOriginalReply(interaction.application_id, interaction.token);

		const hostLatency = new Date(message.timestamp).getTime() - DiscordSnowflake.timestampFrom(interaction.id);

		return this.client.api.interactions.editReply(interaction.application_id, interaction.token, {
			content: language.get("PONG", {
				hostLatency,
			}),
			allowed_mentions: { parse: [], replied_user: true },
		});
	}
}
