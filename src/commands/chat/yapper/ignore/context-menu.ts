import type { Subcommand } from "@hijuno/botkit"
import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { ignoredUsers } from "@/db/schema"

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("context_menu")
    .setDescription("Prevent others from transcribing your messages via the context menu"),

  async execute(interaction) {
    const userId = interaction.user.id
    const existing = await db.query.ignoredUsers.findFirst({ where: eq(ignoredUsers.userId, userId) })

    if (existing?.type === "CONTEXT_MENU") {
      await db.delete(ignoredUsers).where(eq(ignoredUsers.userId, userId))
      return interaction.reply({ content: "Context menu transcription by others is now **allowed**.", flags: MessageFlags.Ephemeral })
    }

    await db.insert(ignoredUsers).values({ userId, type: "CONTEXT_MENU" }).onConflictDoUpdate({ target: ignoredUsers.userId, set: { type: "CONTEXT_MENU" } })
    return interaction.reply({ content: "Others can no longer transcribe your messages via context menu.", flags: MessageFlags.Ephemeral })
  }
} satisfies Subcommand
