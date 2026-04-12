import "@/env"
import { env } from "node:process"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@/db/schema"

export const db = drizzle(env.DATABASE_URL, { schema, casing: "snake_case" })
