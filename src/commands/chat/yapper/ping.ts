import type { Subcommand } from "@hijuno/botkit"
import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js"

export default {
  data: new SlashCommandSubcommandBuilder().setName("ping").setDescription("Check bot latency"),

  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp
    await interaction.reply({
      content: `Pong! Latency: ${latency}ms`,
      flags: MessageFlags.Ephemeral
    })
  }
} satisfies Subcommand
