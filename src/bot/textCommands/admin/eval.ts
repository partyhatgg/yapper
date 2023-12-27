import { inspect } from "node:util";
import type { GatewayMessageCreateDispatchData } from "@discordjs/core";
import type Language from "../../../../lib/classes/Language.js";
import StopWatch from "../../../../lib/classes/StopWatch.js";
import TextCommand from "../../../../lib/classes/TextCommand.js";
import Type from "../../../../lib/classes/Type.js";
import type ExtendedClient from "../../../../lib/extensions/ExtendedClient.js";

export default class Eval extends TextCommand {
	/**
	 * Create our eval command.
	 *
	 * @param client Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		super(client, {
			name: "eval",
			description: "Evaluates arbitrary JavaScript code.",
			devOnly: true,
		});
	}

	/**
	 * Run this text command.
	 *
	 * @param options The options for this command.
	 * @param options.args The arguments for this command.
	 * @param options.language The language for this command.
	 * @param options.message The message that triggered this command.
	 * @param options.shardId The shard ID that this command was triggered on.
	 */
	public override async run({
		message,
		args,
	}: {
		args: string[];
		language: Language;
		message: GatewayMessageCreateDispatchData;
		shardId: number;
	}) {
		this.client.logger.info(
			`${message.author.username}#${message.author.discriminator} ran eval in ${message.guild_id}, ${args.join(" ")}`,
		);

		const { success, result, time, type } = await this.eval(message, args.join(" "));
		if (message.content.includes("--silent")) return null;

		if (result.length > 4_087)
			return this.client.api.channels.createMessage(message.channel_id, {
				embeds: [
					{
						title: success ? "🆗 Evaluated successfully." : "🆘 JavaScript failed.",
						description: `Output too long for Discord, view it [here](${await this.client.functions.uploadToHastebin(
							result,
							{ type: "ts" },
						)}).`,
						fields: [
							{
								name: "Type",
								value: `\`\`\`ts\n${type}\`\`\`\n${time}`,
							},
						],
						color: success ? this.client.config.colors.success : this.client.config.colors.error,
					},
				],
				allowed_mentions: { parse: [], replied_user: true },
			});

		return this.client.api.channels.createMessage(message.channel_id, {
			embeds: [
				{
					title: success ? "🆗 Evaluated successfully." : "🆘 JavaScript failed.",
					description: `\`\`\`js\n${result}\`\`\``,
					fields: [
						{
							name: "Type",
							value: `\`\`\`ts\n${type}\`\`\`\n${time}`,
						},
					],
					color: success ? this.client.config.colors.success : this.client.config.colors.error,
				},
			],
			allowed_mentions: { parse: [], replied_user: true },
		});
	}

	private async eval(message: GatewayMessageCreateDispatchData, code: string) {
		code = code.replaceAll(/[“”]/g, '"').replaceAll(/[‘’]/g, "'");
		const stopwatch = new StopWatch();
		let success;
		let syncTime;
		let asyncTime;
		let result;
		let thenable = false;
		let type;
		try {
			if (message.content.includes("--async")) code = `(async () => {\n${code}\n})();`;
			// eslint-disable-next-line no-eval
			result = eval(code);
			syncTime = stopwatch.toString();
			type = new Type(result);
			if (this.client.functions.isThenable(result)) {
				thenable = true;
				stopwatch.restart();
				result = await result;
				asyncTime = stopwatch.toString();
				type.addValue(result);
			}

			success = true;
		} catch (error: any) {
			if (!syncTime) syncTime = stopwatch.toString();
			if (!type) type = new Type(error);
			if (thenable && !asyncTime) asyncTime = stopwatch.toString();
			result = error;
			success = false;
		}

		stopwatch.stop();
		return {
			success,
			type,
			time: this.formatTime(syncTime, asyncTime),
			result: inspect(result),
		};
	}

	private formatTime(syncTime: string, asyncTime?: string) {
		return asyncTime ? `⏱ ${asyncTime}<${syncTime}>` : `⏱ ${syncTime}`;
	}
}
