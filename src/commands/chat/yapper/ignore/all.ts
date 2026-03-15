import type { Subcommand } from "@hijuno/botkit"
import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { ignoredUsers } from "@/db/schema"

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("all")
    .setDescription("Prevent all transcription of your messages (you can still transcribe your own)"),

  async execute(interaction) {
    const userId = interaction.user.id
    const existing = await db.query.ignoredUsers.findFirst({ where: eq(ignoredUsers.userId, userId) })

    if (existing?.type === "ALL") {
      await db.delete(ignoredUsers).where(eq(ignoredUsers.userId, userId))
      return interaction.reply({ content: "All transcription of your messages is now **allowed**.", flags: MessageFlags.Ephemeral })
    }

    await db.insert(ignoredUsers).values({ userId, type: "ALL" }).onConflictDoUpdate({ target: ignoredUsers.userId, set: { type: "ALL" } })
    return interaction.reply({ content: "Your messages will no longer be transcribed by anyone else.", flags: MessageFlags.Ephemeral })
  }
} satisfies Subcommand
