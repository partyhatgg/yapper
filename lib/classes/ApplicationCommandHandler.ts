import { env } from "node:process";
import { setTimeout } from "node:timers";
import type {
	APIApplicationCommandInteraction,
	APIChatInputApplicationCommandInteraction,
	APIInteractionDataResolved,
	RESTPostAPIWebhookWithTokenJSONBody,
	WithIntrinsicProps,
} from "@discordjs/core";
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	MessageFlags,
	RESTJSONErrorCodes,
} from "@discordjs/core";
import { DiscordAPIError } from "@discordjs/rest";
import type { APIInteractionWithArguments, InteractionArguments } from "../../typings";
import type ExtendedClient from "../extensions/ExtendedClient.js";
import { logCommandUsage } from "../utilities/metrics.js";
import applicationCommandOptionTypeReference from "../utilities/reference.js";
import type ApplicationCommand from "./ApplicationCommand.js";
import type Language from "./Language.js";

export default class ApplicationCommandHandler {
	/**
	 * Our extended client.
	 */
	public readonly client: ExtendedClient;

	/**
	 * How long a user must wait before being able to run an application command again.
	 */
	public readonly coolDownTime: number;

	/**
	 * A list of user IDs that currently have a cooldown applied.
	 */
	public readonly cooldowns: Set<string>;

	/**
	 * Create our application command handler.
	 *
	 * @param client Our extended client.
	 */
	public constructor(client: ExtendedClient) {
		this.client = client;

		this.coolDownTime = 200;
		this.cooldowns = new Set();
	}

	/**
	 * Load all of the application commands in the applicationCommands directory.
	 */
	public async loadApplicationCommands() {
		for (const parentFolder of this.client.functions.getFiles(
			`${this.client.__dirname}/dist/src/bot/applicationCommands`,
			"",
			true,
		)) {
			for (const fileName of this.client.functions.getFiles(
				`${this.client.__dirname}/dist/src/bot/applicationCommands/${parentFolder}`,
				".js",
			)) {
				const CommandFile = await import(`../../src/bot/applicationCommands/${parentFolder}/${fileName}`);

				const command = new CommandFile.default(this.client) as ApplicationCommand;

				this.client.applicationCommands.set(command.name, command);
			}
		}
	}

	/**
	 * Register all of the application commands on Discord.
	 *
	 * @returns True or False depending on if the application commands were registered successfully.
	 */
	public async registerApplicationCommands() {
		if (env.NODE_ENV === "production") {
			const guildOnlyCommands: Map<string, ApplicationCommand[]> = new Map();

			for (const applicationCommand of [...this.client.applicationCommands.values()].filter(
				(applicationCommand) => applicationCommand.guilds.length,
			)) {
				for (const guildId of applicationCommand.guilds)
					guildOnlyCommands.set(guildId, (guildOnlyCommands.get(guildId) ?? []).concat([applicationCommand]));
			}

			return Promise.all([
				this.client.api.applicationCommands
					.bulkOverwriteGuildCommands(env.APPLICATION_ID, env.DEVELOPMENT_GUILD_ID, [])
					// eslint-disable-next-line promise/prefer-await-to-callbacks, promise/prefer-await-to-then
					.catch(async (error) => {
						if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingAccess)
							this.client.logger.error(
								null,
								`I encountered DiscordAPIError: Missing Access in ${env.DEVELOPMENT_GUILD_ID} when trying to clear application commands in the test guild.`,
							);

						await this.client.logger.sentry.captureWithExtras(error, {
							"Guild ID": env.DEVELOPMENT_GUILD_ID,
							"Application Command Count": this.client.applicationCommands.size,
							"Application Commands": this.client.applicationCommands,
						});
						throw error;
					}),
				this.client.api.applicationCommands.bulkOverwriteGlobalCommands(
					env.APPLICATION_ID,
					[...this.client.applicationCommands.values()]
						.filter((applicationCommand) => !applicationCommand.guilds.length)
						.map((applicationCommand) => applicationCommand.options),
				),
				[...guildOnlyCommands.entries()].map(async ([guildId, applicationCommands]) =>
					this.client.api.applicationCommands
						.bulkOverwriteGuildCommands(
							env.APPLICATION_ID,
							guildId,
							applicationCommands.map((applicationCommand) => applicationCommand.options),
						)
						// eslint-disable-next-line promise/prefer-await-to-callbacks, promise/prefer-await-to-then
						.catch(async (error) => {
							if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingAccess)
								this.client.logger.error(
									null,
									`I encountered DiscordAPIError: Missing Access in ${env.DEVELOPMENT_GUILD_ID} when trying to set guild commands.`,
								);

							await this.client.logger.sentry.captureWithExtras(error, {
								"Guild ID": env.DEVELOPMENT_GUILD_ID,
								"Application Command Count": this.client.applicationCommands.size,
								"Application Commands": this.client.applicationCommands,
							});
							throw error;
						}),
				),
			]);
		}

		return (
			this.client.api.applicationCommands
				.bulkOverwriteGuildCommands(
					env.APPLICATION_ID,
					env.DEVELOPMENT_GUILD_ID,
					[...this.client.applicationCommands.values()].map((applicationCommand) => applicationCommand.options),
				)
				// eslint-disable-next-line promise/prefer-await-to-callbacks, promise/prefer-await-to-then
				.catch(async (error) => {
					if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingAccess)
						this.client.logger.error(
							null,
							`I encountered DiscordAPIError: Missing Access in ${env.DEVELOPMENT_GUILD_ID} when trying to set application commands in the test guild.`,
						);

					await this.client.logger.sentry.captureWithExtras(error, {
						"Guild ID": env.DEVELOPMENT_GUILD_ID,
						"Application Command Count": this.client.applicationCommands.size,
						"Application Commands": this.client.applicationCommands,
					});

					throw error;
				})
		);
	}

	/**
	 * Reload all of the application commands.
	 *
	 * @param register Whether or not to register the application commands after reloading them.
	 * @returns The result of the registerApplicationCommands method if register is true, otherwise undefined.
	 */
	public async reloadApplicationCommands(register = true) {
		this.client.applicationCommands.clear();
		await this.loadApplicationCommands();

		if (register) return this.registerApplicationCommands();

		return null;
	}

	/**
	 * Get an application command by its name.
	 *
	 * @param name The name of the application command.
	 * @returns The application command with the specified name if it exists, otherwise undefined.
	 */
	private getApplicationCommand(name: string) {
		return this.client.applicationCommands.get(name);
	}

	/**
	 * Handle an interaction properly to ensure that it can invoke an application command.
	 *
	 * @param options The interaction that is attempting to invoke an application command.
	 * @param options.data The interaction data.
	 * @param options.shardId The shard ID that the interaction was received on.
	 */
	public async handleApplicationCommand({
		data: interaction,
		shardId,
	}: Omit<WithIntrinsicProps<APIApplicationCommandInteraction>, "api">) {
		const userLanguage = await this.client.prisma.userLanguage.findUnique({
			where: {
				userId: (interaction.member ?? interaction).user!.id,
			},
		});
		const language = this.client.languageHandler.getLanguage(userLanguage?.languageId ?? interaction.locale);

		const applicationCommand = this.getApplicationCommand(interaction.data.name);

		if (!applicationCommand) {
			this.client.logger.error(
				null,
				`${(interaction.member?.user ?? interaction.user!).username}#${
					(interaction.member?.user ?? interaction.user!).discriminator
				} [${(interaction.member ?? interaction).user!.id}] invoked application command ${
					interaction.data.name
				} but it does not exist.`,
			);
			const eventId = await this.client.logger.sentry.captureWithInteraction(
				new Error("Non existent application command invoked."),
				interaction,
			);

			try {
				if (env.NODE_ENV === "production")
					await this.client.api.applicationCommands.deleteGlobalCommand(
						interaction.application_id,
						interaction.data.id,
					);
				else
					await this.client.api.applicationCommands.deleteGuildCommand(
						interaction.application_id,
						interaction.data.id,
						interaction.guild_id ?? env.DEVELOPMENT_GUILD_ID,
					);
			} catch (error) {
				if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingAccess)
					this.client.logger.error(
						null,
						`I encountered DiscordAPIError: Missing Access in the test guild [${env.DEVELOPMENT_GUILD_ID}] when trying to delete a non-existent application command.`,
					);

				await this.client.logger.sentry.captureWithExtras(error, {
					"Guild ID": env.DEVELOPMENT_GUILD_ID,
					"Application Command Count": this.client.applicationCommands.size,
					"Application Commands": this.client.applicationCommands,
				});
				throw error;
			}

			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				embeds: [
					{
						title: language.get("NON_EXISTENT_APPLICATION_COMMAND_TITLE", {
							type: interaction.data.type === ApplicationCommandType.ChatInput ? "Slash Command" : "Context Menu",
						}),
						description: language.get("NON_EXISTENT_APPLICATION_COMMAND_DESCRIPTION", {
							name: interaction.data.name,
							type: interaction.data.type === ApplicationCommandType.ChatInput ? "slash command" : "context menu",
							username: (interaction.member?.user ?? interaction.user!).username,
						}),
						footer: {
							text: language.get("SENTRY_EVENT_ID_FOOTER", {
								eventId,
							}),
						},
						color: this.client.config.colors.error,
					},
				],
				flags: MessageFlags.Ephemeral,
				allowed_mentions: { parse: [], replied_user: true },
			});
		}

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

		if (interaction.data.type === ApplicationCommandType.ChatInput) {
			let parentOptions = (interaction as APIChatInputApplicationCommandInteraction).data.options ?? [];

			while (parentOptions.length) {
				const currentOption = parentOptions.pop();

				if (!currentOption) continue;

				if (currentOption.type === ApplicationCommandOptionType.SubcommandGroup) {
					applicationCommandArguments.subCommandGroup = currentOption;
					parentOptions = currentOption.options;
				} else if (currentOption.type === ApplicationCommandOptionType.Subcommand) {
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
						currentOption.value.toString() in interaction.data.resolved[identifier as keyof APIInteractionDataResolved]!
					) {
						const resolved = interaction.data.resolved[identifier as keyof APIInteractionDataResolved]![
							currentOption.value.toString()
						] as any;

						applicationCommandArguments[identifier]![currentOption.name] = resolved;

						if (
							"members" in interaction.data.resolved &&
							interaction.data.resolved.members[currentOption.value.toString()]
						) {
							if (!applicationCommandArguments.members) applicationCommandArguments.members = {};

							applicationCommandArguments.members![currentOption.name] =
								interaction.data.resolved.members[currentOption.value.toString()]!;
						}

						continue;
					}

					applicationCommandArguments[identifier]![currentOption.name] = currentOption as any;
				}
			}
		}

		const interactionWithArguments = { ...interaction, arguments: applicationCommandArguments };

		const missingPermissions = await applicationCommand.validate({
			interaction: interactionWithArguments,
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

		const [preChecked, preCheckedResponse] = await applicationCommand.preCheck({
			interaction: interactionWithArguments,
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

		return this.runApplicationCommand(applicationCommand, interactionWithArguments, shardId, language);
	}

	/**
	 * Run an application command.
	 *
	 * @param applicationCommand The application command we want to run.
	 * @param interaction The interaction that invoked the application command.
	 * @param shardId The shard ID that the interaction was received on.
	 * @param language The language to use when replying to the interaction.
	 */
	private async runApplicationCommand(
		applicationCommand: ApplicationCommand,
		interaction: APIInteractionWithArguments<APIApplicationCommandInteraction>,
		shardId: number,
		language: Language,
	) {
		if (this.cooldowns.has((interaction.member ?? interaction).user!.id))
			return this.client.api.interactions.reply(interaction.id, interaction.token, {
				embeds: [
					{
						title: language.get("COOLDOWN_ON_TYPE_TITLE", {
							type: applicationCommand.type === ApplicationCommandType.ChatInput ? "Slash Commands" : "Context Menus",
						}),
						description: language.get("COOLDOWN_ON_TYPE_DESCRIPTION", {
							type: applicationCommand.type === ApplicationCommandType.ChatInput ? "slash command" : "context menu",
						}),
						color: this.client.config.colors.error,
					},
				],
				flags: MessageFlags.Ephemeral,
				allowed_mentions: { parse: [], replied_user: true },
			});

		try {
			await applicationCommand.run({
				interaction,
				language,
				shardId,
			});

			if (applicationCommand.cooldown)
				await applicationCommand.applyCooldown((interaction.member ?? interaction).user!.id);

			logCommandUsage(applicationCommand, shardId, true);
		} catch (error) {
			logCommandUsage(applicationCommand, shardId, false);
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
				allowed_mentions: { parse: [], replied_user: true },
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

		this.cooldowns.add((interaction.member ?? interaction).user!.id);
		setTimeout(() => this.cooldowns.delete((interaction.member ?? interaction).user!.id), this.coolDownTime);
	}
}
