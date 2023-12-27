import { setTimeout } from "node:timers";
import type {
	APIMessageComponentButtonInteraction,
	RESTPostAPIWebhookWithTokenJSONBody,
	WithIntrinsicProps,
} from "@discordjs/core";
import { MessageFlags, RESTJSONErrorCodes } from "@discordjs/core";
import { DiscordAPIError } from "@discordjs/rest";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import type Button from "./Button.js";
import type Language from "./Language.js";

export default class ButtonHandler {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * How long a user must wait before being able to run a button again.
	 */
	public readonly coolDownTime: number;

	/**
	 * A list of user IDs that currently have a cooldown applied.
	 */
	public readonly cooldowns: Set<string>;

	/**
	 * Create our button handler/
	 *
	 * @param client Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		this.client = client;

		this.coolDownTime = 200;
		this.cooldowns = new Set();
	}

	/**
	 * Load all of the buttons in the buttons directory.
	 */
	public async loadButtons() {
		for (const parentFolder of this.client.functions.getFiles(
			`${this.client.__dirname}/dist/src/bot/buttons`,
			"",
			true,
		)) {
			for (const fileName of this.client.functions.getFiles(
				`${this.client.__dirname}/dist/src/bot/buttons/${parentFolder}`,
				".js",
			)) {
				const ButtonFile = await import(`../../src/bot/buttons/${parentFolder}/${fileName}`);

				const button = new ButtonFile.default(this.client) as Button;

				this.client.buttons.set(button.name, button);
			}
		}
	}

	/**
	 * Reload all of the buttons.
	 */
	public async reloadButtons() {
		this.client.buttons.clear();
		await this.loadButtons();
	}

	/**
	 * Get the button that a customId qualifies for.
	 *
	 * @param customId The customId of the button.
	 * @returns The button that the customId qualifies for.
	 */
	private async getButton(customId: string) {
		return [...this.client.buttons.values()].find((button) => customId.startsWith(button.name));
	}

	/**
	 * Handle a n interaction properly to ensure that it can invoke a button.
	 *
	 * @param options The interaction that is attempted to invoke a button.
	 * @param options.data The interaction data.
	 * @param options.shardId The shard ID that the interaction was received on.
	 */
	public async handleButton({
		data: interaction,
		shardId,
	}: Omit<WithIntrinsicProps<APIMessageComponentButtonInteraction>, "api">) {
		const userLanguage = await this.client.prisma.userLanguage.findUnique({
			where: {
				userId: (interaction.member?.user ?? interaction.user!).id,
			},
		});
		const language = this.client.languageHandler.getLanguage(userLanguage?.languageId ?? interaction.locale);

		const button = await this.getButton(interaction.data.custom_id);

		if (!button) return;

		const missingPermissions = await button.validate({
			interaction,
			language,
			shardId,
		});
		if (missingPermissions)
			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				embeds: [
					{
						...missingPermissions,
						color: this.client.config.colors.error,
					},
				],
				flags: MessageFlags.Ephemeral,
				allowed_mentions: { parse: [], replied_user: true },
			});

		const [preChecked, preCheckedResponse] = await button.preCheck({
			interaction,
			language,
			shardId,
		});
		if (!preChecked) {
			if (preCheckedResponse)
				await this.client.api.interactions.reply(interaction.id, interaction.token, {
					embeds: [
						{
							...preCheckedResponse,
							color: this.client.config.colors.error,
						},
					],
					flags: MessageFlags.Ephemeral,
					allowed_mentions: { parse: [], replied_user: true },
				});

			return;
		}

		return this.runButton(button, interaction, shardId, language);
	}

	/**
	 * Run a button.
	 *
	 * @param button The button we want to run.
	 * @param interaction The interaction that invoked the button.
	 * @param shardId The shard ID that the interaction was received on.
	 * @param language The language to use when replying to the interaction.
	 */
	private async runButton(
		button: Button,
		interaction: APIMessageComponentButtonInteraction,
		shardId: number,
		language: Language,
	) {
		if (this.cooldowns.has((interaction.member?.user ?? interaction.user!).id))
			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				embeds: [
					{
						title: language.get("COOLDOWN_ON_TYPE_TITLE", {
							type: "Buttons",
						}),
						description: language.get("COOLDOWN_ON_TYPE_DESCRIPTION", {
							type: "button",
						}),
						color: this.client.config.colors.error,
					},
				],
				flags: MessageFlags.Ephemeral,
				allowed_mentions: { parse: [], replied_user: true },
			});

		try {
			await button.run({
				interaction,
				language,
				shardId,
			});
		} catch (error) {
			this.client.logger.error(error);

			const eventId = await this.client.logger.sentry.captureWithInteraction(error, interaction);

			const toSend = {
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
				flags: MessageFlags.Ephemeral,
			} satisfies RESTPostAPIWebhookWithTokenJSONBody;

			try {
				await this.client.api.interactions.reply(interaction.id, interaction.token, toSend);
				return;
			} catch (error) {
				if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged)
					return this.client.api.interactions.followUp(interaction.application_id, interaction.token, toSend);

				await this.client.logger.sentry.captureWithInteraction(error, interaction);
				throw error;
			}
		}

		this.cooldowns.add((interaction.member?.user ?? interaction.user!).id);
		setTimeout(() => this.cooldowns.delete((interaction.member?.user ?? interaction.user!).id), this.coolDownTime);
	}
}
