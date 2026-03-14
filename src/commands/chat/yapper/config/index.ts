import type { CommandGroup } from "@hijuno/botkit"
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js"

export default {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure Yapper for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
} satisfies CommandGroup
