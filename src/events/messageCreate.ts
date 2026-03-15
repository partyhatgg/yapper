import type { Message } from "discord.js"
import { MessageFlags, MessageReferenceType } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { autoTranscriptVoiceMessages, ignoredUsers } from "@/db/schema"
import { logger } from "@/util/logger"
import { resolveMessageSource } from "@/util/resolveMessageSource"
import { queueTranscription } from "@/util/transcription"

export async function handleMessageCreate(message: Message) {
  if (message.author.bot) return
  if (!message.inGuild()) return

  const isDirectVoiceMessage = message.flags.has(MessageFlags.IsVoiceMessage)
  const isComponentsV2 = message.flags.has(MessageFlags.IsComponentsV2)
  const isForwardedVoiceMessage = message.reference?.type === MessageReferenceType.Forward && message.messageSnapshots.first()?.flags.has(MessageFlags.IsVoiceMessage)

  if (!isDirectVoiceMessage && !isComponentsV2 && !isForwardedVoiceMessage) return

  const source = await resolveMessageSource(message, message.client)
  if (!source) return

  const { attachmentUrl, originalMessageId, originalAuthorId } = source

  const [setting, ignored] = await Promise.all([
    db.query.autoTranscriptVoiceMessages.findFirst({
      where: eq(autoTranscriptVoiceMessages.guildId, message.guildId)
    }),
    originalAuthorId ? db.query.ignoredUsers.findFirst({ where: eq(ignoredUsers.userId, originalAuthorId) }) : Promise.resolve(undefined)
  ])

  if (!setting?.enabled) return
  if (ignored && (ignored.type === "AUTO_TRANSCRIPTION" || ignored.type === "ALL")) return

  let reply: Message
  try {
    reply = await message.reply({ content: "Transcribing...", allowedMentions: { parse: [] } })
  } catch (err) {
    logger.warn({ err, messageId: message.id }, "failed to send transcribing reply")
    return
  }

  try {
    await queueTranscription({
      attachmentUrl,
      originalMessageId,
      guildId: message.guildId,
      channelId: message.channelId,
      interactionToken: null,
      messageId: reply.id,
      writeToDb: true
    })
  } catch (err) {
    logger.error({ err, messageId: message.id }, "failed to queue transcription")
    await reply.edit("Sorry, failed to start transcription.")
  }
}
