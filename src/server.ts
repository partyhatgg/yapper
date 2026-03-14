import { serve } from "@hono/node-server"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { db } from "@/db/index"
import { jobs } from "@/db/schema"
import { processJobResult } from "@/util/jobProcessor"
import { logger } from "@/util/logger"
import type { RunpodJobStatus } from "@/util/runpod"

export function createServer(): Hono {
  const app = new Hono()

  app.post("/webhook/runpod", async (c) => {
    let body: RunpodJobStatus
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "invalid json" }, 400)
    }

    logger.info({ jobId: body.id, status: body.status }, "received RunPod webhook")

    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, body.id) })
    if (!job) {
      logger.warn({ jobId: body.id }, "job not found, may have already been processed by poller")
      return c.json({ error: "job not found" }, 404)
    }

    await processJobResult(job, body)
    return c.json({ ok: true })
  })

  return app
}

export function startServer(app: Hono, port: number) {
  serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`Hono server listening on ${info.address}:${info.port}`)
  })
}
