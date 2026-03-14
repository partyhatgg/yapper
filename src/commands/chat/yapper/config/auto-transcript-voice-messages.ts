import type { Subcommand } from "@hijuno/botkit"
import { SlashCommandSubcommandBuilder } from "discord.js"
import { db } from "@/db/index"
import { autoTranscriptVoiceMessages } from "@/db/schema"

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("auto-transcript-voice-messages")
    .setDescription("Enable or disable automatic transcription of voice messages")
    .addBooleanOption((opt) => opt.setName("enabled").setDescription("Enable or disable auto-transcription").setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guildId!
    const enabled = interaction.options.getBoolean("enabled", true)

    await db.insert(autoTranscriptVoiceMessages).values({ guildId, enabled }).onConflictDoUpdate({ target: autoTranscriptVoiceMessages.guildId, set: { enabled } })

    return interaction.reply({
      content: enabled ? "Auto-transcription of voice messages is now **enabled** for this server." : "Auto-transcription of voice messages is now **disabled** for this server."
    })
  }
} satisfies Subcommand
