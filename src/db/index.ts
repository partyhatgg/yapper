import "@/env"
import { env } from "node:process"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "@/db/schema"
import { logger } from "@/util/logger"

const pool = new Pool({ connectionString: env.DATABASE_URL })
pool.on("error", (err) => logger.error({ err }, "postgres pool error"))

export const db = drizzle(pool, { schema, casing: "snake_case" })
