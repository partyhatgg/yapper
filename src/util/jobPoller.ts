import { eq, lt } from "drizzle-orm"
import cron from "node-cron"
import { db } from "@/db/index"
import { type Job, jobs } from "@/db/schema"
import { processJobResult } from "@/util/jobProcessor"
import { logger } from "@/util/logger"
import { getRunpodJobStatus, type RunpodJobStatus } from "@/util/runpod"
import { editReply } from "@/util/transcription"

const POLL_AFTER_SUBMIT_MS = 5_000
const JOB_MAX_AGE_MS = 30 * 60 * 1000

export function startJobPoller(): void {
  cron.schedule("* * * * * *", async () => {
    try {
      await pollPendingJobs()
    } catch (err) {
      logger.error({ err }, "job poller: unhandled error in poll cycle")
    }
  })
  logger.info("job poller started")
}

async function pollPendingJobs() {
  const cutoff = new Date(Date.now() - POLL_AFTER_SUBMIT_MS)
  const pending = await db.query.jobs.findMany({ where: lt(jobs.createdAt, cutoff) })
  if (pending.length === 0) return

  logger.info({ count: pending.length }, "polling pending jobs")
  await Promise.allSettled(pending.map(pollJob))
}

async function pollJob(job: Job) {
  const ageMs = Date.now() - job.createdAt.getTime()

  let status: RunpodJobStatus
  try {
    status = await getRunpodJobStatus(job.id)
  } catch (err) {
    logger.error({ err, jobId: job.id, ageMs }, "failed to fetch job status from RunPod")
    if (ageMs > JOB_MAX_AGE_MS) await purgeJob(job)
    return
  }

  logger.debug({ jobId: job.id, status: status.status, ageMs }, "polled job")

  if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
    if (ageMs > JOB_MAX_AGE_MS) await purgeJob(job)
    return
  }

  try {
    await processJobResult(job, status)
  } catch (err) {
    logger.error({ err, jobId: job.id }, "failed to process job result")
  }
}

async function purgeJob(job: Job) {
  logger.warn({ jobId: job.id }, "purging stale job")
  const deleted = await db.delete(jobs).where(eq(jobs.id, job.id)).returning({ id: jobs.id })
  if (deleted.length === 0) return
  await editReply(job, { content: "Transcription timed out. Please try again.", allowed_mentions: { parse: [] } }).catch((err) => logger.warn({ err, jobId: job.id }, "could not notify user of timeout"))
}
