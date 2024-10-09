declare global {
	namespace NodeJS {
		interface ProcessEnv {
			APPLICATION_ID: string;
			BASE_URL: string;
			CLIENT_SECRET: string;
			CONSOLE_HOOK: string;
			DATABASE_URL: string;
			DEVELOPMENT_GUILD_ID: string;
			DISCORD_TOKEN: string;
			GUILD_HOOK: string;
			NODE_ENV: "development" | "production";
			RUNPOD_API_KEY: string;
			RUNPOD_HQ_ENDPOINT_ID: string;
			RUNPOD_LQ_ENDPOINT_ID: string;
			SECRET: string;
			SENTRY_DSN: string;
			STRIPE_KEY: string;
			STRIPE_WEBHOOK_SECRET: string;
			WEB_PORT: string;
		}
	}
}

export type {};
