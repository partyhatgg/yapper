import { env, loadEnvFile } from "node:process"
import type { Config } from "drizzle-kit"

try {
  loadEnvFile(env.NODE_ENV === "production" ? ".env.prod" : ".env")
} catch {}
if (env.DATABASE_URL === undefined) {
  throw new Error("DATABASE_URL is not defined")
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL
  }
} satisfies Config
