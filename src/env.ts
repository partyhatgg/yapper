import { env, loadEnvFile } from "node:process"

try {
  loadEnvFile(env.NODE_ENV === "production" ? ".env.prod" : ".env")
} catch {}
