import { env } from "node:process";
import { inspect } from "node:util";
import type { RESTPostAPIWebhookWithTokenJSONBody } from "@discordjs/core";
import { bgGreenBright, bgMagentaBright, bgRedBright, bgYellowBright, bold } from "colorette";
import { sentry } from "../utilities/instrumentation.js";

export class Logger {
	/**
	 * Our Sentry client.
	 */
	public readonly sentry;

	/**
	 * A Map<string, WebhookClient> whose key value pair correlates to the type of log we want and the WebhookClient for the log.
	 */
	private readonly webhooks: Map<string, string>;

	/**
	 * Create our logger.
	 */
	public constructor() {
		this.sentry = sentry;
		this.webhooks = new Map();
	}

	/**
	 * Get the current timestamp.
	 *
	 * @returns The current timestamp in the format of MM/DD/YYYY @ HH:mm:SS.
	 */
	public get timestamp(): string {
		const nowISOString = new Date().toISOString();
		const [year, month, day] = nowISOString.slice(0, 10).split("-");
		return `${month}/${day}/${year} @ ${nowISOString.slice(11, 19)}`;
	}

	/**
	 * Log out a debug statement.
	 *
	 * @param args The arguments to log out.
	 */
	public debug(...args: any[]): void {
		console.log(
			bold(bgMagentaBright(`[${this.timestamp}]`)),
			bold(args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 1 }))).join(" ")),
		);
	}

	/**
	 * Log out an info statement.
	 *
	 * @param args The arguments to log out.
	 */
	public info(...args: any[]): void {
		console.log(
			bold(bgGreenBright(`[${this.timestamp}]`)),
			bold(args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 1 }))).join(" ")),
		);
	}

	/**
	 * Log out a warn statement.
	 *
	 * @param args The arguments to log out.
	 */
	public warn(...args: any[]): void {
		console.log(
			bold(bgYellowBright(`[${this.timestamp}]`)),
			bold(args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 1 }))).join(" ")),
		);
	}

	/**
	 * Log out an error statement.
	 *
	 * @param error The error to log out.
	 * @param args The arguments to log out.
	 */
	public error(error: any | null, ...args: any[]): void {
		if (error)
			console.log(
				bold(bgRedBright(`[${this.timestamp}]`)),
				error,
				bold(args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 1 }))).join(" ")),
			);
		else
			console.log(
				bold(bgRedBright(`[${this.timestamp}]`)),
				bold(args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 1 }))).join(" ")),
			);
	}

	/**
	 * Log a message to Discord through a webhook.
	 *
	 * @param type The webhook type to log out to, make sure that the webhook provided in your .env file is in the format ${TYPE}_HOOK=...
	 * @returns The message that was sent.
	 */
	public async webhookLog(type: string, options: RESTPostAPIWebhookWithTokenJSONBody) {
		if (!type) throw new Error("No webhook type has been provided!");
		if (!this.webhooks.get(type.toLowerCase())) {
			const webhookURL = env[`${type.toUpperCase()}_HOOK`];
			if (!webhookURL) {
				this.warn(`No webhook URL has been provided for ${type}!`);
				return;
			}

			this.webhooks.set(type.toLowerCase(), webhookURL);
		}

		const webhookURL = this.webhooks.get(type.toLowerCase());

		return fetch(webhookURL!, {
			method: "POST",
			body: JSON.stringify(options),
			headers: { "Content-Type": "application/json" },
		});
	}
}

export default new Logger();
