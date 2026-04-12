import { dirname, join } from "node:path"
import { env } from "node:process"
import { fileURLToPath } from "node:url"
import { loadCommands, registerCommands } from "@hijuno/botkit"
import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType, InteractionType, type Message, Routes } from "discord.js"
import { client } from "@/client"
import { db } from "@/db/index"
import { handleGuildCreate } from "@/events/guildCreate"
import { handleGuildDelete } from "@/events/guildDelete"
import { handleMessageCreate } from "@/events/messageCreate"
import { createServer, startServer } from "@/server"
import { startJobPoller } from "@/util/jobPoller"
import { handleTranscribeCommand } from "@/util/transcribeHandler"
import { queueTranscription } from "@/util/transcription"

export { db }

const __dirname = dirname(fileURLToPath(import.meta.url))

const port = Number(env.PORT ?? 3000)
const app = createServer()
startServer(app, port)

client.once("clientReady", async () => {
  const { commandMap, builders } = await loadCommands(join(__dirname, "commands"), client.logger)

  // Append context menu commands to builders for registration
  builders.push(
    {
      type: ApplicationCommandType.Message,
      name: "Transcribe",
      integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
      contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]
    },
    {
      type: ApplicationCommandType.Message,
      name: "Transcribe Privately",
      integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
      contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]
    }
  )

  await registerCommands(env.TOKEN, env.CLIENT_ID, builders)
  client.setCommandMap(commandMap)

  startJobPoller()

  const application = (await client.rest.get(Routes.currentApplication())) as { approximate_user_install_count?: number }
  client.logger.info(`Ready as ${client.user?.tag} — ${client.guilds.cache.size} guilds, ${application.approximate_user_install_count ?? 0} user installs`)
})

// Handle context menu commands and button interactions manually
client.on("interactionCreate", async (interaction) => {
  // Message context menus
  if (interaction.type === InteractionType.ApplicationCommand && interaction.isMessageContextMenuCommand()) {
    if (interaction.commandName === "Transcribe") {
      await handleTranscribeCommand(interaction, false)
    } else if (interaction.commandName === "Transcribe Privately") {
      await handleTranscribeCommand(interaction, true)
    }
    return
  }

  // Button interactions
  if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
    if (!interaction.customId.startsWith("retry:")) return

    const [, channelId, originalMessageId] = interaction.customId.split(":")
    if (!channelId || !originalMessageId) return

    await interaction.deferReply()
    const deferred = await interaction.fetchReply()

    let originalMessage: Message | null = null
    try {
      const channel = await interaction.client.channels.fetch(channelId)
      originalMessage = channel?.isTextBased() ? await channel.messages.fetch(originalMessageId) : null
    } catch (err) {
      client.logger.warn({ err, channelId, originalMessageId }, "retry: failed to fetch original message")
      return interaction.editReply("I can't access that channel or message anymore (missing permissions or it was deleted).")
    }

    if (!originalMessage) {
      return interaction.editReply("Could not find the original message.")
    }

    const attachment = originalMessage.attachments.first()
    if (!attachment) {
      return interaction.editReply("No audio attachment found on the original message.")
    }

    await queueTranscription({
      attachmentUrl: attachment.url,
      originalMessageId,
      guildId: interaction.guildId,
      channelId,
      interactionToken: interaction.token,
      messageId: deferred.id,
      writeToDb: true
    })
  }
})

client.on("messageCreate", handleMessageCreate)
client.on("guildCreate", (guild) => handleGuildCreate(guild))
client.on("guildDelete", (guild) => handleGuildDelete(guild))

client.on("error", (err) => client.logger.error({ err }, "discord client error"))

client.login(env.TOKEN)

export { client as Bot }
