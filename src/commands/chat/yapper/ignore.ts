import type { Subcommand } from "@hijuno/botkit"
import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "@/db/index"
import { ignoredUsers } from "@/db/schema"

export default {
  data: new SlashCommandSubcommandBuilder().setName("ignore").setDescription("Toggle whether Yapper processes your voice messages"),

  async execute(interaction) {
    const userId = interaction.user.id

    const existing = await db.query.ignoredUsers.findFirst({
      where: eq(ignoredUsers.userId, userId)
    })

    if (existing) {
      await db.delete(ignoredUsers).where(eq(ignoredUsers.userId, userId))
      return interaction.reply({
        content: "You are now opted **in** — your voice messages will be transcribed.",
        flags: MessageFlags.Ephemeral
      })
    }

    await db.insert(ignoredUsers).values({ userId })
    return interaction.reply({
      content: "You are now opted **out** — your voice messages will not be transcribed.",
      flags: MessageFlags.Ephemeral
    })
  }
} satisfies Subcommand
