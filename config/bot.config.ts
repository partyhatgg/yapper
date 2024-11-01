import { execSync } from "node:child_process";
import { env } from "node:process";
import type { GatewayPresenceUpdateData } from "@discordjs/core";
import { ActivityType, GatewayIntentBits, PermissionFlagsBits } from "@discordjs/core";

export default {
	/**
	 * The prefix the bot will use for text commands, the prefix is different depending on the NODE_ENV.
	 */
	prefixes: env.NODE_ENV === "production" ? ["y!"] : ["y!!"],

	/**
	 * The name the bot should use across the bot.
	 */
	botName: "Yapper",

	/**
	 * A list of file types that the bot will transcribe.
	 */
	allowedFileTypes: ["audio/ogg", "audio/mpeg", "audio/mp4", "video/mp4", "video/webm", "video/quicktime"],

	/**
	 * The bot's current version, this is the first 7 characters of the current Git commit hash.
	 */
	version: env.NODE_ENV === "production" ? execSync("git rev-parse --short HEAD").toString().trim() : "dev",

	/**
	 * A list of users that are marked as administrators of the bot, these users have access to eval commands.
	 */
	admins: ["619284841187246090", "194861788926443520"],

	/**
	 * The presence that should be displayed when the bot starts running.
	 */
	presence: {
		status: "online",
		activities: [
			{
				type: ActivityType.Listening,
				name: "voice messages.",
			},
		],
	} as GatewayPresenceUpdateData,

	/**
	 * The hastebin server that we should use for uploading logs.
	 */
	hastebin: "https://hst.sh",

	/**
	 * An object of the type Record<string, string>, the key corelating to when the value (a hexadecimal code) should be used.
	 */
	colors: {
		primary: 0x5865f2,
		success: 0x57f287,
		warning: 0xfee75c,
		error: 0xed4245,
	},

	/**
	 * The list of intents the bot requires to function.
	 */
	intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,

	/**
	 * A list of permissions that the bot needs to function at all.
	 */
	requiredPermissions: PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks,
};
