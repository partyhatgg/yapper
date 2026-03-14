import type { Message } from "discord.js"
import { MessageFlags } from "discord.js"
import { eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type * as schema from "@/db/schema"
import { autoTranscriptVoiceMessages, ignoredUsers } from "@/db/schema"
import { logger } from "@/util/logger"
import { queueTranscription } from "@/util/transcription"

type Db = NodePgDatabase<typeof schema>

export async function handleMessageCreate(message: Message, db: Db) {
  if (message.author.bot) return
  if (!message.inGuild()) return
  if (!message.flags.has(MessageFlags.IsVoiceMessage)) return

  const [setting, ignored] = await Promise.all([
    db.query.autoTranscriptVoiceMessages.findFirst({
      where: eq(autoTranscriptVoiceMessages.guildId, message.guildId)
    }),
    db.query.ignoredUsers.findFirst({
      where: eq(ignoredUsers.userId, message.author.id)
    })
  ])

  if (!setting?.enabled) return
  if (ignored) return

  const attachment = message.attachments.first()
  if (!attachment) return

  let reply: Message
  try {
    reply = await message.reply({
      content: "Transcribing...",
      allowedMentions: { parse: [] }
    })
  } catch (err) {
    logger.warn({ err, messageId: message.id }, "Failed to send transcribing reply")
    return
  }

  try {
    await queueTranscription(
      {
        attachmentUrl: attachment.url,
        originalMessageId: message.id,
        guildId: message.guildId,
        channelId: message.channelId,
        interactionToken: null,
        messageId: reply.id,
        writeToDb: true
      },
      db
    )
  } catch (err) {
    logger.error({ err, messageId: message.id }, "Failed to queue transcription")
    await reply.edit("Sorry, failed to start transcription.")
  }
}
