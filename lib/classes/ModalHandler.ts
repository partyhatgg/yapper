import { setTimeout } from "node:timers";
import type {
	APIModalSubmitInteraction,
	RESTPostAPIWebhookWithTokenJSONBody,
	WithIntrinsicProps,
} from "@discordjs/core";
import { MessageFlags, RESTJSONErrorCodes } from "@discordjs/core";
import { DiscordAPIError } from "@discordjs/rest";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import type Language from "./Language.js";
import type Modal from "./Modal.js";

export default class ModalHandler {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * How long a user must wait before being able to use a modal again.
	 */
	public readonly coolDownTime: number;

	/**
	 * A list of user IDs that currently have a cooldown applied.
	 */
	public readonly cooldowns: Set<string>;

	/**
	 * Create our modal handler.
	 *
	 * @param client Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		this.client = client;

		this.coolDownTime = 200;
		this.cooldowns = new Set();
	}

	/**
	 * Load all of the modals in the modals directory.
	 */
	public async loadModals() {
		for (const parentFolder of this.client.functions.getFiles(
			`${this.client.__dirname}/dist/src/bot/modals`,
			"",
			true,
		)) {
			for (const fileName of this.client.functions.getFiles(
				`${this.client.__dirname}/dist/src/bot/modals/${parentFolder}`,
				".js",
			)) {
				const ModalFile = await import(`../../src/bot/modals/${parentFolder}/${fileName}`);

				const modal = new ModalFile.default(this.client) as Modal;

				this.client.modals.set(modal.name, modal);
			}
		}
	}

	/**
	 * Reload all of the modals.
	 */
	public async reloadModals() {
		this.client.modals.clear();
		await this.loadModals();
	}

	/**
	 * Get the modal that a customId qualifies for.
	 *
	 * @param customId The customId of the modal.
	 * @returns The modal that the customId qualifies for.
	 */
	private async getModal(customId: string) {
		return [...this.client.modals.values()].find((modal) => customId.startsWith(modal.name));
	}

	/**
	 * Handle an interaction properly to ensure that it can invoke a modal.
	 *
	 * @param options The interaction that is attempted to invoke a modal.
	 * @param options.data The interaction data.
	 * @param options.shardId The shard ID that the interaction was received on.
	 */
	public async handleModal({ data: interaction, shardId }: Omit<WithIntrinsicProps<APIModalSubmitInteraction>, "api">) {
		const userLanguage = await this.client.prisma.userLanguage.findUnique({
			where: {
				userId: (interaction.member?.user ?? interaction.user!).id,
			},
		});
		const language = this.client.languageHandler.getLanguage(userLanguage?.languageId ?? interaction.locale);

		const modal = await this.getModal(interaction.data.custom_id);

		if (!modal) return;

		const missingPermissions = await modal.validate({
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

		const [preChecked, preCheckedResponse] = await modal.preCheck({
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

		return this.runModal(modal, interaction, shardId, language);
	}

	/**
	 * Run a modal.
	 *
	 * @param modal The modal we want to run.
	 * @param interaction The interaction that invoked the modal.
	 * @param shardId The shard ID that the interaction was received on.
	 * @param language The language to use when replying to the interaction.
	 */
	private async runModal(modal: Modal, interaction: APIModalSubmitInteraction, shardId: number, language: Language) {
		if (this.cooldowns.has((interaction.member?.user ?? interaction.user!).id))
			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				embeds: [
					{
						title: language.get("COOLDOWN_ON_TYPE_TITLE", {
							type: "Modals",
						}),
						description: language.get("COOLDOWN_ON_TYPE_DESCRIPTION", {
							type: "modal",
						}),
						color: this.client.config.colors.error,
					},
				],
				flags: MessageFlags.Ephemeral,
				allowed_mentions: { parse: [], replied_user: true },
			});

		try {
			await modal.run({
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
