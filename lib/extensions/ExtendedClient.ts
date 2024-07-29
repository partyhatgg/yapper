import { resolve } from "node:path";
import { env } from "node:process";
import type { APIRole, ClientOptions, MappedEvents } from "@discordjs/core";
import { API, Client } from "@discordjs/core";
import { PrismaClient } from "@prisma/client";
import i18next from "i18next";
import intervalPlural from "i18next-intervalplural-postprocessor";
import Stripe from "stripe";
import Config from "../../config/bot.config.js";
import type ApplicationCommand from "../classes/ApplicationCommand.js";
import ApplicationCommandHandler from "../classes/ApplicationCommandHandler.js";
import type AutoComplete from "../classes/AutoComplete.js";
import AutoCompleteHandler from "../classes/AutoCompleteHandler.js";
import type Button from "../classes/Button.js";
import ButtonHandler from "../classes/ButtonHandler.js";
import type EventHandler from "../classes/EventHandler.js";
import LanguageHandler from "../classes/LanguageHandler.js";
import Logger from "../classes/Logger.js";
import type Modal from "../classes/Modal.js";
import ModalHandler from "../classes/ModalHandler.js";
import type SelectMenu from "../classes/SelectMenu.js";
import SelectMenuHandler from "../classes/SelectMenuHandler.js";
import type TextCommand from "../classes/TextCommand.js";
import TextCommandHandler from "../classes/TextCommandHandler.js";
import Functions from "../utilities/functions.js";

export default class ExtendedClient extends Client {
	/**
	 * An API instance to make using Discord's API much easier.
	 */
	public override readonly api: API;

	// public override gateway: Gateway;

	/**
	 * The configuration for our bot.
	 */
	public readonly config: typeof Config;

	/**
	 * The logger for our bot.
	 */
	public readonly logger: typeof Logger;

	/**
	 * The functions for our bot.
	 */
	public readonly functions: Functions;

	/**
	 * The i18n instance for our bot.
	 */
	public readonly i18n: typeof i18next;

	/**
	 * __dirname is not in our version of ECMA, this is a workaround.
	 */
	public readonly __dirname: string;

	/**
	 * Our Prisma client, this is an ORM to interact with our PostgreSQL instance.
	 */
	public readonly prisma: PrismaClient<{
		errorFormat: "pretty";
		log: (
			| {
					emit: "event";
					level: "query";
			  }
			| {
					emit: "stdout";
					level: "error";
			  }
			| {
					emit: "stdout";
					level: "warn";
			  }
		)[];
	}>;

	/**
	 * All of the different gauges we use for Metrics with Prometheus and Grafana.
	 */
	// private readonly gauges: Map<keyof typeof metrics, Gauge>;

	/**
	 * A map of guild ID to user ID, representing a guild and who owns it.
	 */
	public guildOwnersCache: Map<string, string>;

	/**
	 * Guild roles cache.
	 */

	public guildRolesCache: Map<string, Map<string, APIRole>>;

	/**
	 * An approximation of how many users the bot can see.
	 */
	public approximateUserCount: number;

	/**
	 * The language handler for our bot.
	 */
	public readonly languageHandler: LanguageHandler;

	/**
	 * A map of events that our client is listening to.
	 */
	public events: Map<keyof MappedEvents, EventHandler>;

	/**
	 * A map of the application commands that the bot is currently handling.
	 */
	public applicationCommands: Map<string, ApplicationCommand>;

	/**
	 * The application command handler for our bot.
	 */
	public readonly applicationCommandHandler: ApplicationCommandHandler;

	/**
	 * A map of the auto completes that the bot is currently handling.
	 */
	public autoCompletes: Map<string[], AutoComplete>;

	/**
	 * The auto complete handler for our bot.
	 */
	public readonly autoCompleteHandler: AutoCompleteHandler;

	/**
	 * A map of the text commands that the bot is currently handling.
	 */
	public readonly textCommands: Map<string, TextCommand>;

	/**
	 * The text command handler for our bot.
	 */
	public readonly textCommandHandler: TextCommandHandler;

	/**
	 * A map of the buttons that the bot is currently handling.
	 */
	public readonly buttons: Map<string, Button>;

	/**
	 * The button handler for our bot.
	 */
	public readonly buttonHandler: ButtonHandler;

	/**
	 * A map of the select menus the bot is currently handling.
	 */
	public readonly selectMenus: Map<string, SelectMenu>;

	/**
	 * The select menu handler for our bot.
	 */
	public readonly selectMenuHandler: SelectMenuHandler;

	/**
	 * A map of modals the bot is currently handling.
	 */
	public readonly modals: Map<string, Modal>;

	/**
	 * The modal handler for our bot.
	 */
	public readonly modalHandler: ModalHandler;

	/**
	 * Our Stripe client
	 */
	public readonly stripe?: Stripe;

	public constructor({ rest, gateway }: ClientOptions) {
		super({ rest, gateway });

		this.api = new API(rest);

		this.config = Config;
		this.logger = Logger;
		this.functions = new Functions(this);

		this.prisma = new PrismaClient({
			errorFormat: "pretty",
			log: [
				{
					level: "warn",
					emit: "stdout",
				},
				{
					level: "error",
					emit: "stdout",
				},
				{ level: "query", emit: "event" },
			],
		});

		this.guildOwnersCache = new Map();
		this.guildRolesCache = new Map();

		this.approximateUserCount = 0;

		// I forget what this is even used for, but Vlad from https://github.com/vladfrangu/highlight uses it and recommended me to use it a while ago.
		if (env.NODE_ENV === "development") {
			this.prisma.$use(async (params, next) => {
				const before = Date.now();
				// eslint-disable-next-line n/callback-return
				const result = await next(params);
				const after = Date.now();

				this.logger.debug("prisma:query", `${params.model}.${params.action} took ${String(after - before)}ms`);

				return result;
			});
		}

		if (env.STRIPE_KEY) {
			this.stripe = new Stripe(env.STRIPE_KEY);
		}

		this.i18n = i18next;

		this.__dirname = resolve();

		this.languageHandler = new LanguageHandler(this);

		this.applicationCommands = new Map();
		this.applicationCommandHandler = new ApplicationCommandHandler(this);

		this.autoCompletes = new Map();
		this.autoCompleteHandler = new AutoCompleteHandler(this);

		this.textCommands = new Map();
		this.textCommandHandler = new TextCommandHandler(this);

		this.buttons = new Map();
		this.buttonHandler = new ButtonHandler(this);

		this.selectMenus = new Map();
		this.selectMenuHandler = new SelectMenuHandler(this);

		this.modals = new Map();
		this.modalHandler = new ModalHandler(this);

		this.events = new Map();
		void this.loadEvents();
	}

	/**
	 * Start the client.
	 */
	public async start() {
		await this.i18n.use(intervalPlural).init({
			fallbackLng: "en-US",
			resources: {},
			fallbackNS: this.config.botName.toLowerCase().split(" ").join("_"),
			lng: "en-US",
		});

		await this.languageHandler.loadLanguages();
		await this.autoCompleteHandler.loadAutoCompletes();
		await this.applicationCommandHandler.loadApplicationCommands();
		await this.textCommandHandler.loadTextCommands();
		await this.buttonHandler.loadButtons();
		await this.selectMenuHandler.loadSelectMenus();
		await this.modalHandler.loadModals();
	}

	/**
	 * Load all the events in the events directory.
	 */
	private async loadEvents() {
		for (const eventFileName of this.functions.getFiles(`${this.__dirname}/dist/src/bot/events`, ".js", true)) {
			const EventFile = await import(`../../src/bot/events/${eventFileName}`);

			const event = new EventFile.default(this) as EventHandler;

			event.listen();

			this.events.set(event.name, event);
		}
	}
}
