import { env } from "node:process"
import type { Guild } from "discord.js"
import { logger } from "@/util/logger"
import { guildsGauge, usersGauge } from "@/util/metrics"

export async function handleGuildDelete(guild: Guild) {
  // Ignore unavailable guilds (outage, not a real leave)
  if (!guild.available) return

  logger.info({ guildId: guild.id, guildName: guild.name }, "Left guild")

  guildsGauge.record(guild.client.guilds.cache.size)
  usersGauge.record(guild.client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0))

  if (!env.GUILD_LOG_WEBHOOK_URL) return

  await fetch(env.GUILD_LOG_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "Left a server",
          color: 0xed4245,
          fields: [
            { name: "Name", value: guild.name, inline: true },
            { name: "ID", value: guild.id, inline: true }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    })
  }).catch((err) => logger.warn({ err }, "Failed to post guild leave webhook"))
}
