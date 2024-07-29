import { setTimeout } from "node:timers";
import type { GatewayMessageCreateDispatchData, WithIntrinsicProps } from "@discordjs/core";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import type Language from "./Language.js";
import type TextCommand from "./TextCommand";
import { logCommandUsage } from "../utilities/metrics.js";

export default class TextCommandHandler {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * How long a user must wait before being able to run a text command again.
	 */
	public readonly coolDownTime: number;

	/**
	 * A list of user IDs that currently have a cooldown applied.
	 */
	public readonly cooldowns: Set<string>;

	/**
	 * Create our text command handler.
	 *
	 * @param client Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		this.client = client;

		this.coolDownTime = 200;
		this.cooldowns = new Set();
	}

	/**
	 * Load all of the text commands in the textCommands directory.
	 */
	public async loadTextCommands() {
		for (const parentFolder of this.client.functions.getFiles(
			`${this.client.__dirname}/dist/src/bot/textCommands`,
			"",
			true,
		)) {
			for (const fileName of this.client.functions.getFiles(
				`${this.client.__dirname}/dist/src/bot/textCommands/${parentFolder}`,
				".js",
			)) {
				const CommandFile = await import(`../../src/bot/textCommands/${parentFolder}/${fileName}`);

				const command = new CommandFile.default(this.client) as TextCommand;

				this.client.textCommands.set(command.name, command);
			}
		}
	}

	/**
	 * Reload all of the text commands.
	 */
	public async reloadTextCommands() {
		this.client.textCommands.clear();
		await this.loadTextCommands();
	}

	/**
	 * Get a text command by its name.
	 *
	 * @param name The name of the text command.
	 * @returns The text command with the specified name if it exists, otherwise undefined.
	 */
	private getTextCommand(name: string) {
		return this.client.textCommands.get(name);
	}

	/**
	 * Handle a message properly to ensure that it can invoke a text command.
	 *
	 * @param options The interaction that is attempting to invoke a text command.
	 * @param options.data The message data.
	 * @param options.shardId The shard ID that the message was received on.
	 */
	public async handleTextCommand({
		data: message,
		shardId,
	}: Omit<WithIntrinsicProps<GatewayMessageCreateDispatchData>, "api">) {
		const validPrefix = this.client.config.prefixes.find((prefix) => message.content.startsWith(prefix));
		if (!validPrefix) return;

		const userLanguage = await this.client.prisma.userLanguage.findUnique({
			where: {
				userId: message.author.id,
			},
		});

		const language = this.client.languageHandler.getLanguage(userLanguage?.languageId);

		const textCommandArguments = message.content.slice(validPrefix.length).trim().split(/ +/g);
		const textCommandName = textCommandArguments.shift()?.toLowerCase();

		const textCommand = this.getTextCommand(textCommandName ?? "");
		if (!textCommand) return;

		const missingPermissions = await textCommand.validate({ language, message, shardId, args: textCommandArguments });
		if (missingPermissions)
			return this.client.api.channels.createMessage(message.channel_id, {
				embeds: [
					{
						...missingPermissions,
						color: this.client.config.colors.error,
					},
				],
				message_reference: {
					message_id: message.id,
					fail_if_not_exists: false,
				},
				allowed_mentions: { parse: [], replied_user: true },
			});

		const [preChecked, preCheckedResponse] = await textCommand.preCheck({
			message,
			language,
			shardId,
			args: textCommandArguments,
		});
		if (!preChecked) {
			if (preCheckedResponse) {
				return this.client.api.channels.createMessage(message.channel_id, {
					embeds: [
						{
							...preCheckedResponse,
							color: this.client.config.colors.error,
						},
					],
					message_reference: {
						message_id: message.id,
						fail_if_not_exists: false,
					},
					allowed_mentions: { parse: [], replied_user: true },
				});
			}

			return;
		}

		return this.runTextCommand(textCommand, message, shardId, language, textCommandArguments);
	}

	/**
	 * Run a text command.
	 *
	 * @param textCommand The text command we want to run.
	 * @param message The message that invoked the text command.
	 * @param shardId The shard ID that the message was received on.
	 * @param language The language to use when replying to the interaction.
	 * @param args The arguments to pass to the text command.
	 * @returns The result of the text command.
	 */
	private async runTextCommand(
		textCommand: TextCommand,
		message: GatewayMessageCreateDispatchData,
		shardId: number,
		language: Language,
		args: string[],
	) {
		if (this.cooldowns.has(message.author.id))
			return this.client.api.channels.createMessage(message.channel_id, {
				embeds: [
					{
						title: language.get("COOLDOWN_ON_TYPE_TITLE", {
							type: "Command",
						}),
						description: language.get("COOLDOWN_ON_TYPE_DESCRIPTION", { type: "command" }),
						color: this.client.config.colors.error,
					},
				],
				message_reference: {
					message_id: message.id,
					fail_if_not_exists: false,
				},
				allowed_mentions: { parse: [], replied_user: true },
			});

		try {
			await textCommand.run({
				args,
				language,
				message,
				shardId,
			});

			if (textCommand.cooldown) await textCommand.applyCooldown(message.author.id);

			logCommandUsage(textCommand, shardId, true);
		} catch (error) {
			logCommandUsage(textCommand, shardId, false);
			this.client.logger.error(error);

			const eventId = await this.client.logger.sentry.captureWithMessage(error, message);

			return this.client.api.channels.createMessage(message.channel_id, {
				embeds: [
					{
						title: language.get("AN_ERROR_HAS_OCCURRED_TITLE"),
						description: language.get("AN_ERROR_HAS_OCCURRED_DESCRIPTION"),
						footer: {
							text: language.get("SENTRY_EVENT_ID_FOOTER", {
								eventId,
							}),
						},
						color: this.client.config.colors.error,
					},
				],
				allowed_mentions: { parse: [], replied_user: true },
			});
		}

		this.cooldowns.add(message.author.id);
		return setTimeout(() => this.cooldowns.delete(message.author.id), this.coolDownTime);
	}
}
