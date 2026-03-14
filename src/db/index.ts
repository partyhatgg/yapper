import { env, loadEnvFile } from "node:process"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@/db/schema"

try {
  loadEnvFile(env.NODE_ENV === "production" ? ".env.prod" : ".env")
} catch {}

export const db = drizzle(env.DATABASE_URL, { schema, casing: "snake_case" })
