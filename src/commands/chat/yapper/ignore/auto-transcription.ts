import type { Subcommand } from "@hijuno/botkit"
import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { ignoredUsers } from "@/db/schema"

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("auto_transcription")
    .setDescription("Prevent your voice messages from being auto-transcribed in servers"),

  async execute(interaction) {
    const userId = interaction.user.id
    const existing = await db.query.ignoredUsers.findFirst({ where: eq(ignoredUsers.userId, userId) })

    if (existing?.type === "auto_transcription") {
      await db.delete(ignoredUsers).where(eq(ignoredUsers.userId, userId))
      return interaction.reply({ content: "Auto-transcription of your voice messages is now **enabled**.", flags: MessageFlags.Ephemeral })
    }

    await db.insert(ignoredUsers).values({ userId, type: "auto_transcription" }).onConflictDoUpdate({ target: ignoredUsers.userId, set: { type: "auto_transcription" } })
    return interaction.reply({ content: "Your voice messages will no longer be auto-transcribed.", flags: MessageFlags.Ephemeral })
  }
} satisfies Subcommand
