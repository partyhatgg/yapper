import { setTimeout } from "node:timers";
import type {
	APIMessageComponentSelectMenuInteraction,
	RESTPostAPIWebhookWithTokenJSONBody,
	WithIntrinsicProps,
} from "@discordjs/core";
import { MessageFlags, RESTJSONErrorCodes } from "@discordjs/core";
import { DiscordAPIError } from "@discordjs/rest";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import type Language from "./Language.js";
import type SelectMenu from "./SelectMenu.js";

export default class SelectMenuHandler {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * How long a user must wait before being able to run a select menu again.
	 */
	public readonly coolDownTime: number;

	/**
	 * A list of user IDs that currently have a cooldown applied.
	 */
	public readonly cooldowns: Set<string>;

	/**
	 * Create our select menu handler.
	 *
	 * @param client Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		this.client = client;

		this.coolDownTime = 200;
		this.cooldowns = new Set();
	}

	/**
	 * Load all of the select menus in the selectMenus directory.
	 */
	public async loadSelectMenus() {
		for (const parentFolder of this.client.functions.getFiles(
			`${this.client.__dirname}/dist/src/bot/selectMenus`,
			"",
			true,
		)) {
			for (const fileName of this.client.functions.getFiles(
				`${this.client.__dirname}/dist/src/bot/selectMenus/${parentFolder}`,
				".js",
			)) {
				const SelectMenuFile = await import(`../../src/bot/selectMenus/${parentFolder}/${fileName}`);

				const selectMenu = new SelectMenuFile.default(this.client) as SelectMenu;

				this.client.selectMenus.set(selectMenu.name, selectMenu);
			}
		}
	}

	/**
	 * Reload all of the select menus.
	 */
	public async reloadSelectMenus() {
		this.client.selectMenus.clear();
		await this.loadSelectMenus();
	}

	/**
	 * Get the select menu that a customId qualifies for.
	 *
	 * @param customId The customId of the select menu.
	 * @returns The select menu that the customId qualifies for.
	 */
	private async getSelectMenu(customId: string) {
		return [...this.client.selectMenus.values()].find((selectMenu) => customId.startsWith(selectMenu.name));
	}

	/**
	 * Handle an interaction properly to ensure that it can invoke a select menu.
	 *
	 * @param options The interaction that is attempted to invoke a select menu.
	 * @param options.data The interaction data.
	 * @param options.shardId The shard ID that the interaction was received on.
	 */
	public async handleSelectMenu({
		data: interaction,
		shardId,
	}: Omit<WithIntrinsicProps<APIMessageComponentSelectMenuInteraction>, "api">) {
		const userLanguage = await this.client.prisma.userLanguage.findUnique({
			where: {
				userId: (interaction.member?.user ?? interaction.user!).id,
			},
		});
		const language = this.client.languageHandler.getLanguage(userLanguage?.languageId ?? interaction.locale);

		const selectMenu = await this.getSelectMenu(interaction.data.custom_id);

		if (!selectMenu) return;

		const missingPermissions = await selectMenu.validate({
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

		const [preChecked, preCheckedResponse] = await selectMenu.preCheck({
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

		return this.runSelectMenu(selectMenu, interaction, shardId, language);
	}

	/**
	 * Run a select menu.
	 *
	 * @param selectMenu The select menu we want to run.
	 * @param interaction The interaction that invoked the select menu.
	 * @param shardId The shard ID that the interaction was received on.
	 * @param language The language to use when replying to the interaction.
	 */
	private async runSelectMenu(
		selectMenu: SelectMenu,
		interaction: APIMessageComponentSelectMenuInteraction,
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
			await selectMenu.run({
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
