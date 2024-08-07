import { ApplicationCommandType } from "@discordjs/core";
import { metrics } from "@opentelemetry/api";
import botConfig from "../../config/bot.config.js";
import type ApplicationCommand from "../classes/ApplicationCommand";
import type TextCommand from "../classes/TextCommand";

const meter = metrics.getMeter(botConfig.botName);

/**
 * Counter: Counter is a metric value that can only increase or reset i.e. the value cannot reduce than the previous value.
 * It can be used for metrics like the number of requests, no of errors, etc.
 *
 * Gauge: Gauge is a number which can either go up or down.
 * It can be used for metrics like the number of pods in a cluster, the number of events in a queue, etc.
 */

const commandUsageMeter = meter.createCounter("command_used");

export function logCommandUsage(command: ApplicationCommand | TextCommand, shardId: number, success: boolean) {
	commandUsageMeter.add(1, {
		command: command.name,
		type: "type" in command ? "text" : ApplicationCommandType.ChatInput ? "slash" : "context",
		success,
		shard: shardId,
	});
}

export const approximateUserCountGauge = meter.createGauge("approximate_user_count");
export const userInstallationGauge = meter.createGauge("user_installations");
export const guildCountGauge = meter.createGauge("guild_count");
export const guildGauge = meter.createGauge("guilds");

export const autoCompleteMetric = meter.createCounter("autocomplete_responses");
export const websocketEventMetric = meter.createCounter("websocket_events");
export const interactionsMetric = meter.createCounter("interactions_created");
export const userLocalesMetric = meter.createCounter("user_locales");

// Bot Specific
export const transcriptionsMetric = meter.createCounter("transcriptions");
