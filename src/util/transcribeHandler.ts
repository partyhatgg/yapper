import type { MessageContextMenuCommandInteraction } from "discord.js"
import { MessageFlags } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { ignoredUsers, transcriptions } from "@/db/schema"
import { queueTranscription } from "@/util/transcription"

function messageUrl(guildId: string | null, channelId: string, messageId: string): string {
  const guildPart = guildId ?? "@me"
  return `https://discord.com/channels/${guildPart}/${channelId}/${messageId}`
}

export async function handleTranscribeCommand(interaction: MessageContextMenuCommandInteraction, ephemeral: boolean) {
  const target = interaction.targetMessage

  if (target.author.id !== interaction.user.id) {
    const ignored = await db.query.ignoredUsers.findFirst({
      where: eq(ignoredUsers.userId, target.author.id)
    })
    if (ignored) {
      return interaction.reply({
        content: "This user has opted out of transcription.",
        flags: MessageFlags.Ephemeral
      })
    }
  }

  const attachment = target.attachments.first()
  if (!attachment) {
    return interaction.reply({
      content: "This message has no audio attachment to transcribe.",
      flags: MessageFlags.Ephemeral
    })
  }

  if (!ephemeral) {
    const existing = await db.query.transcriptions.findFirst({
      where: eq(transcriptions.messageId, target.id)
    })
    if (existing) {
      // Point the user directly to the existing transcription.
      // For thread transcriptions, link into the thread.
      // For short transcriptions, link to the original voice message — the reply sits right below it.
      const url = existing.threadId
        ? messageUrl(interaction.guildId, existing.threadId, existing.threadId)
        : messageUrl(interaction.guildId, interaction.channelId, target.id)

      return interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [
          {
            type: 10, // Text Display
            content: "This message has already been transcribed."
          },
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 5, // Link
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

  await queueTranscription(
    {
      attachmentUrl: attachment.url,
      originalMessageId: target.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      interactionToken: interaction.token,
      messageId: deferred.id,
      writeToDb: !ephemeral
    },
    db
  )
}
