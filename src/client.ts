import { FrameworkClient } from "@hijuno/botkit"
import { GatewayIntentBits } from "discord.js"
import { logger } from "@/util/logger"

export const client = new FrameworkClient({
  clientOptions: {
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  },
  logger
})
