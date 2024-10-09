import { env } from "node:process";
import { REST } from "@discordjs/rest";
import { CompressionMethod, WebSocketManager, WebSocketShardEvents, WorkerShardingStrategy } from "@discordjs/ws";
import { load } from "dotenv-extended";
import botConfig from "../config/bot.config.js";
import Logger from "../lib/classes/Logger.js";
import Server from "../lib/classes/Server.js";
import ExtendedClient from "../lib/extensions/ExtendedClient.js";

load({
	path: env.NODE_ENV === "production" ? ".env.prod" : ".env.dev",
});

// Create REST and WebSocket managers directly.
const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
const gateway = new WebSocketManager({
	token: env.DISCORD_TOKEN,
	intents: botConfig.intents,
	initialPresence: botConfig.presence,
	compression: CompressionMethod.ZlibNative,
	rest,
	// This will cause 2 workers to spawn, 3 shards per worker.
	// "each shard gets its own bubble which handles decoding, heartbeats, etc. And your main thread just gets the final result" - Vlad.
	buildStrategy: (manager) => new WorkerShardingStrategy(manager, { shardsPerWorker: 3 }),
});

await new Server(Number.parseInt(env.WEB_PORT, 10)).start();

const client = new ExtendedClient({ rest, gateway });
await client.start();

await gateway.connect().then(async () => {
	await client.applicationCommandHandler.registerApplicationCommands();
	Logger.info("All shards have started.");
});

if (env.NODE_ENV === "development") {
	gateway.on(WebSocketShardEvents.Debug, (message, shardId) => {
		Logger.debug(`[SHARD ${shardId}] ${message}`);
	});

	gateway.on(WebSocketShardEvents.Ready, (_message, shardId) => {
		Logger.debug(`[SHARD ${shardId}] Ready`);
	});
}
