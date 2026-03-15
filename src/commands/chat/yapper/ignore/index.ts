import type { CommandGroup } from "@hijuno/botkit"
import { SlashCommandBuilder } from "discord.js"

export default {
  data: new SlashCommandBuilder().setName("ignore").setDescription("Configure how Yapper processes your voice messages")
} satisfies CommandGroup
