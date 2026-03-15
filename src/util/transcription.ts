import { env } from "node:process"
import { Routes } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { type Job, jobs, transcriptions } from "@/db/schema"
import { rest } from "@/rest"
import { logger } from "@/util/logger"
import { submitRunpodJob } from "@/util/runpod"

export interface QueueTranscriptionOptions {
  attachmentUrl: string
  originalMessageId: string
  guildId: string | null
  channelId: string
  interactionToken: string | null
  messageId: string
  writeToDb: boolean
}

export async function queueTranscription(opts: QueueTranscriptionOptions): Promise<{ cached: true; threadId: string | null } | { cached: false }> {
  const { attachmentUrl, originalMessageId, guildId, channelId, interactionToken, messageId, writeToDb } = opts

  if (writeToDb) {
    const existing = await db.query.transcriptions.findFirst({
      where: eq(transcriptions.messageId, originalMessageId)
    })
    if (existing) {
      return { cached: true, threadId: existing.threadId ?? null }
    }

    const inProgress = await db.query.jobs.findFirst({
      where: eq(jobs.originalMessageId, originalMessageId)
    })
    if (inProgress) {
      logger.warn({ originalMessageId, jobId: inProgress.id }, "job already in progress, skipping submission")
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

  logger.info({ jobId: job.id, originalMessageId }, "queued transcription job")
  return { cached: false }
}

export async function editReply(job: Job, body: Record<string, unknown>) {
  if (job.interactionToken) {
    await rest.patch(Routes.webhookMessage(env.CLIENT_ID, job.interactionToken), { body })
  } else {
    await rest.patch(Routes.channelMessage(job.channelId, job.messageId), { body })
  }
}
