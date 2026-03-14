import { serve } from "@hono/node-server"
import { ChannelType, type REST, Routes } from "discord.js"
import { eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { Hono } from "hono"
import type * as schema from "@/db/schema"
import { jobs, transcriptions } from "@/db/schema"
import { logger } from "@/util/logger"
import { transcriptionsDurationMs, transcriptionsErrors, transcriptionsTotal } from "@/util/metrics"
import type { RunpodWebhookPayload } from "@/util/runpod"
import { editReply } from "@/util/transcription"

type Db = NodePgDatabase<typeof schema>

const THREADABLE_CHANNEL_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement])

function retryButton(channelId: string, originalMessageId: string) {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 1,
        label: "Retry",
        custom_id: `retry:${channelId}:${originalMessageId}`
      }
    ]
  }
}

function chunkText(text: string, size = 1990): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

export function createServer(db: Db, rest: REST, clientId: string): Hono {
  const app = new Hono()

  app.post("/webhook/runpod", async (c) => {
    let body: RunpodWebhookPayload
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "invalid json" }, 400)
    }

    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, body.id) })
    if (!job) {
      return c.json({ error: "job not found" }, 404)
    }

    await db.delete(jobs).where(eq(jobs.id, body.id))

    if (body.status !== "COMPLETED" || !body.output?.transcription) {
      logger.warn({ jobId: body.id, status: body.status, error: body.error }, "Runpod job failed")
      transcriptionsErrors.add(1, { reason: body.error ?? body.status })

      await editReply(rest, clientId, job, {
        content: "Sorry, transcription failed.",
        allowed_mentions: { parse: [] },
        components: [retryButton(job.channelId, job.originalMessageId)]
      })

      return c.json({ ok: true })
    }

    const { transcription } = body.output
    const durationMs = (body.delayTime ?? 0) + (body.executionTime ?? 0)

    transcriptionsTotal.add(1, {
      guild_id: job.guildId ?? "dm",
      trigger: job.interactionToken ? (job.writeToDb ? "context-menu" : "private") : "auto"
    })
    transcriptionsDurationMs.record(durationMs, { model: job.model })

    logger.info({ jobId: body.id, durationMs, chars: transcription.length }, "Runpod job completed")

    if (!job.writeToDb) {
      const display = transcription.length > 2000 ? `${transcription.slice(0, 1990)}\n...*(truncated)*` : transcription
      await editReply(rest, clientId, job, {
        content: display,
        allowed_mentions: { parse: [] }
      })
      return c.json({ ok: true })
    }

    await db.insert(transcriptions).values({ messageId: job.originalMessageId, content: transcription }).onConflictDoNothing()

    if (transcription.length <= 2000) {
      await editReply(rest, clientId, job, {
        content: transcription,
        allowed_mentions: { parse: [] }
      })
      return c.json({ ok: true })
    }

    if (!job.guildId) {
      await sendFileReply(rest, clientId, job, transcription)
      return c.json({ ok: true })
    }

    const channel = (await rest.get(Routes.channel(job.channelId))) as { type: ChannelType }

    if (THREADABLE_CHANNEL_TYPES.has(channel.type)) {
      await createThreadReply(rest, clientId, db, job, transcription)
    } else {
      await sendFileReply(rest, clientId, job, transcription)
    }

    return c.json({ ok: true })
  })

  return app
}

async function createThreadReply(rest: REST, clientId: string, db: Db, job: typeof jobs.$inferSelect, transcription: string) {
  const thread = (await rest.post(Routes.threads(job.channelId, job.originalMessageId), {
    body: { name: "Transcription", auto_archive_duration: 1440 }
  })) as { id: string }

  const chunks = chunkText(transcription)
  for (const chunk of chunks) {
    await rest.post(Routes.channelMessages(thread.id), {
      body: { content: chunk, allowed_mentions: { parse: [] } }
    })
  }

  await db.update(transcriptions).set({ threadId: thread.id }).where(eq(transcriptions.messageId, job.originalMessageId))

  const threadLink = `https://discord.com/channels/${job.guildId}/${thread.id}`
  await editReply(rest, clientId, job, {
    content: `Transcription: ${threadLink}`,
    allowed_mentions: { parse: [] }
  })

  await rest.patch(Routes.channel(thread.id), {
    body: { locked: true, archived: true }
  })
}

async function sendFileReply(rest: REST, clientId: string, job: typeof jobs.$inferSelect, transcription: string) {
  const preview = transcription.slice(0, 500)
  const route = job.interactionToken ? Routes.webhookMessage(clientId, job.interactionToken) : Routes.channelMessage(job.channelId, job.messageId)

  await rest.patch(route, {
    body: {
      content: preview.length < transcription.length ? `${preview}...\n*(full transcription attached)*` : preview,
      allowed_mentions: { parse: [] }
    },
    files: [{ name: "transcription.txt", data: Buffer.from(transcription), contentType: "text/plain" }]
  })
}

export function startServer(app: Hono, port: number) {
  serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`Hono server listening on ${info.address}:${info.port}`)
  })
}
