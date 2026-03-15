import type { MessageContextMenuCommandInteraction } from "discord.js"
import { ButtonStyle, ComponentType, MessageFlags } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { ignoredUsers, jobs, transcriptions } from "@/db/schema"
import { logger } from "@/util/logger"
import { resolveMessageSource } from "@/util/resolveMessageSource"
import { queueTranscription } from "@/util/transcription"

function messageUrl(guildId: string | null, channelId: string, messageId: string): string {
  const guildPart = guildId ?? "@me"
  return `https://discord.com/channels/${guildPart}/${channelId}/${messageId}`
}

export async function handleTranscribeCommand(interaction: MessageContextMenuCommandInteraction, ephemeral: boolean) {
  const target = interaction.targetMessage

  const source = await resolveMessageSource(target, interaction.client)
  if (!source) {
    return interaction.reply({
      content: "This message has no audio attachment to transcribe.",
      flags: MessageFlags.Ephemeral
    })
  }

  const { attachmentUrl, originalMessageId, originalAuthorId } = source

  if (originalAuthorId && originalAuthorId !== interaction.user.id) {
    const ignored = await db.query.ignoredUsers.findFirst({
      where: eq(ignoredUsers.userId, originalAuthorId)
    })
    if (ignored && (ignored.type === "CONTEXT_MENU" || ignored.type === "ALL")) {
      return interaction.reply({
        content: "This user has opted out of transcription.",
        flags: MessageFlags.Ephemeral
      })
    }
  }

  if (!ephemeral) {
    const [existing, inProgress] = await Promise.all([db.query.transcriptions.findFirst({ where: eq(transcriptions.messageId, originalMessageId) }), db.query.jobs.findFirst({ where: eq(jobs.originalMessageId, originalMessageId) })])

    if (inProgress) {
      logger.info({ originalMessageId, jobId: inProgress.id }, "transcription already in progress")
      return interaction.reply({
        content: "This message is already being transcribed — the result will appear shortly.",
        flags: MessageFlags.Ephemeral
      })
    }

    if (existing) {
      const url = existing.threadId ? messageUrl(interaction.guildId, existing.threadId, existing.threadId) : messageUrl(interaction.guildId, interaction.channelId, existing.replyMessageId ?? originalMessageId)

      return interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: "This message has already been transcribed."
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                label: existing.threadId ? "Jump to thread" : "Jump to transcription",
                url
              }
            ]
          }
        ]
      } as any)
    }
  }

  await interaction.deferReply({ ...(ephemeral && { flags: MessageFlags.Ephemeral }) })
  const deferred = await interaction.fetchReply()

  try {
    await queueTranscription({
      attachmentUrl,
      originalMessageId,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      interactionToken: interaction.token,
      messageId: deferred.id,
      writeToDb: !ephemeral
    })
  } catch (err) {
    logger.error({ err, originalMessageId }, "failed to queue transcription")
    await interaction.editReply("Sorry, failed to start transcription.")
  }
}
