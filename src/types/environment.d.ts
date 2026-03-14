declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production"
      TOKEN: string
      CLIENT_ID: string
      DATABASE_URL: string
      PORT?: string
      RUNPOD_ENDPOINT_ID: string
      RUNPOD_API_KEY: string
      BASE_URL: string
      OTEL_EXPORTER_OTLP_ENDPOINT?: string
      GUILD_LOG_WEBHOOK_URL?: string
    }
  }
}

export {}
