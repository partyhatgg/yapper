import { env } from "node:process"
import { ButtonStyle, ChannelType, ComponentType, Routes } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { type Job, jobs, transcriptions } from "@/db/schema"
import { rest } from "@/rest"
import { logger } from "@/util/logger"
import { transcriptionsDurationMs, transcriptionsErrors, transcriptionsTotal } from "@/util/metrics"
import type { RunpodJobStatus } from "@/util/runpod"
import { editReply } from "@/util/transcription"

const THREADABLE_CHANNEL_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement])

export function retryButton(channelId: string, originalMessageId: string) {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
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

export async function processJobResult(job: Job, result: RunpodJobStatus): Promise<void> {
  // RETURNING ensures idempotency — webhook and poller can race without double-processing
  const deleted = await db.delete(jobs).where(eq(jobs.id, job.id)).returning({ id: jobs.id })
  if (deleted.length === 0) {
    logger.debug({ jobId: job.id }, "job already processed by another handler, skipping")
    return
  }

  if (result.status !== "COMPLETED" || !result.output?.transcription) {
    logger.warn({ jobId: job.id, status: result.status, error: result.error }, "transcription job failed")
    transcriptionsErrors.add(1, { reason: result.error ?? result.status })
    await editReply(job, {
      content: "Sorry, transcription failed.",
      allowed_mentions: { parse: [] },
      components: [retryButton(job.channelId, job.originalMessageId)]
    })
    return
  }

  const { transcription } = result.output
  const durationMs = (result.delayTime ?? 0) + (result.executionTime ?? 0)

  transcriptionsTotal.add(1, {
    guild_id: job.guildId ?? "dm",
    trigger: job.interactionToken ? (job.writeToDb ? "context-menu" : "private") : "auto"
  })
  transcriptionsDurationMs.record(durationMs, { model: job.model })
  logger.info({ jobId: job.id, durationMs, chars: transcription.length }, "transcription job completed")

  if (!job.writeToDb) {
    const display = transcription.length > 2000 ? `${transcription.slice(0, 1990)}\n...*(truncated)*` : transcription
    await editReply(job, { content: display, allowed_mentions: { parse: [] } })
    return
  }

  await db.insert(transcriptions).values({ messageId: job.originalMessageId, replyMessageId: job.messageId }).onConflictDoNothing()

  if (transcription.length <= 2000) {
    await editReply(job, { content: transcription, allowed_mentions: { parse: [] } })
    return
  }

  if (!job.guildId) {
    await sendFileReply(job, transcription)
    return
  }

  const channel = (await rest.get(Routes.channel(job.channelId))) as { type: ChannelType }
  if (THREADABLE_CHANNEL_TYPES.has(channel.type)) {
    await createThreadReply(job, transcription)
  } else {
    await sendFileReply(job, transcription)
  }
}

async function createThreadReply(job: Job, transcription: string) {
  const thread = (await rest.post(Routes.threads(job.channelId, job.messageId), {
    body: { name: "Transcription", auto_archive_duration: 1440 }
  })) as { id: string }

  for (const chunk of chunkText(transcription)) {
    await rest.post(Routes.channelMessages(thread.id), {
      body: { content: chunk, allowed_mentions: { parse: [] } }
    })
  }

  await db.update(transcriptions).set({ threadId: thread.id }).where(eq(transcriptions.messageId, job.originalMessageId))

  const threadLink = `https://discord.com/channels/${job.guildId}/${thread.id}`
  await editReply(job, { content: `:thread: Done - ${threadLink}`, allowed_mentions: { parse: [] } })

  await rest.patch(Routes.channel(thread.id), { body: { locked: true, archived: true } })
}

async function sendFileReply(job: Job, transcription: string) {
  const preview = transcription.slice(0, 500)
  const route = job.interactionToken ? Routes.webhookMessage(env.CLIENT_ID, job.interactionToken) : Routes.channelMessage(job.channelId, job.messageId)
  await rest.patch(route, {
    body: {
      content: preview.length < transcription.length ? `${preview}...\n*(full transcription attached)*` : preview,
      allowed_mentions: { parse: [] }
    },
    files: [{ name: "transcription.txt", data: Buffer.from(transcription), contentType: "text/plain" }]
  })
}
