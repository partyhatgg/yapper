declare global {
	namespace NodeJS {
		interface ProcessEnv {
			APPLICATION_ID: string;
			CLIENT_SECRET: string;
			CONSOLE_HOOK: string;
			DATABASE_URL: string;
			DATADOG_API_KEY: string;
			DEVELOPMENT_GUILD_ID: string;
			DISCORD_TOKEN: string;
			FASTIFY_PORT: string;
			GUILD_HOOK: string;
			NODE_ENV: "development" | "production";
			RUNPOD_API_KEY: string;
			RUNPOD_ENDPOINT_ID: string;
			SENTRY_DSN: string;
		}
	}
}

export {};
