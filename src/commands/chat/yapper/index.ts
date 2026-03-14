import type { CommandGroup } from "@hijuno/botkit"
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from "discord.js"

export default {
  data: new SlashCommandBuilder()
    .setName("yapper")
    .setDescription("Yapper commands")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
} satisfies CommandGroup
