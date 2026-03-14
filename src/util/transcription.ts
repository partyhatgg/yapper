import type { REST } from "discord.js"
import { Routes } from "discord.js"
import { eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type * as schema from "@/db/schema"
import { jobs, transcriptions } from "@/db/schema"
import { logger } from "@/util/logger"
import { submitRunpodJob } from "@/util/runpod"

type Db = NodePgDatabase<typeof schema>

export interface QueueTranscriptionOptions {
  attachmentUrl: string
  originalMessageId: string
  guildId: string | null
  channelId: string
  interactionToken: string | null
  messageId: string
  writeToDb: boolean
}

export async function queueTranscription(opts: QueueTranscriptionOptions, db: Db): Promise<{ cached: true; content: string; threadId: string | null } | { cached: false }> {
  const { attachmentUrl, originalMessageId, guildId, channelId, interactionToken, messageId, writeToDb } = opts

  if (writeToDb) {
    const existing = await db.query.transcriptions.findFirst({
      where: eq(transcriptions.messageId, originalMessageId)
    })
    if (existing) {
      return { cached: true, content: existing.content, threadId: existing.threadId ?? null }
    }

    const inProgress = await db.query.jobs.findFirst({
      where: eq(jobs.originalMessageId, originalMessageId)
    })
    if (inProgress) {
      return { cached: false }
    }
  }

  const job = await submitRunpodJob(attachmentUrl)

  await db.insert(jobs).values({
    id: job.id,
    model: "turbo",
    attachmentUrl,
    interactionToken,
    channelId,
    messageId,
    originalMessageId,
    guildId,
    writeToDb
  })

  logger.info({ jobId: job.id, originalMessageId }, "Queued transcription job")
  return { cached: false }
}

export async function editReply(rest: REST, clientId: string, job: typeof jobs.$inferSelect, body: Record<string, unknown>) {
  if (job.interactionToken) {
    await rest.patch(Routes.webhookMessage(clientId, job.interactionToken), { body })
  } else {
    await rest.patch(Routes.channelMessage(job.channelId, job.messageId), { body })
  }
}
