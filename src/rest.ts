import { REST } from "discord.js"

export const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)
