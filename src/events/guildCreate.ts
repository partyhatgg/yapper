import type { Guild } from "discord.js"
import { logger } from "@/util/logger"
import { guildsGauge, usersGauge } from "@/util/metrics"

export async function handleGuildCreate(guild: Guild) {
  logger.info({ guildId: guild.id, guildName: guild.name, memberCount: guild.memberCount }, "Joined guild")

  guildsGauge.record(guild.client.guilds.cache.size)
  usersGauge.record(guild.client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0))

  if (!process.env.GUILD_LOG_WEBHOOK_URL) return

  await fetch(process.env.GUILD_LOG_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "Joined a new server",
          color: 0x57f287,
          fields: [
            { name: "Name", value: guild.name, inline: true },
            { name: "ID", value: guild.id, inline: true },
            { name: "Members", value: guild.memberCount.toString(), inline: true }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    })
  }).catch((err) => logger.warn({ err }, "Failed to post guild join webhook"))
}
