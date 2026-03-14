import { env, loadEnvFile } from "node:process"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"

try {
  loadEnvFile(env.NODE_ENV === "production" ? ".env.prod" : ".env")
} catch {}

const db = drizzle(env.DATABASE_URL!)

await db.execute(sql`TRUNCATE TABLE jobs, transcriptions RESTART IDENTITY CASCADE`)
console.log("Truncated: jobs, transcriptions")

await migrate(db, { migrationsFolder: "./drizzle" })
console.log("Migrations applied")

process.exit(0)
