import { env, loadEnvFile } from "node:process"
import type { Config } from "drizzle-kit"

loadEnvFile()
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
