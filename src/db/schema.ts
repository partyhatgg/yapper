import { boolean, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const ignoreType = pgEnum("ignore_type", ["CONTEXT_MENU", "AUTO_TRANSCRIPTION", "ALL"])

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  model: text("model").notNull(),
  attachmentUrl: text("attachment_url").notNull(),
  interactionToken: text("interaction_token"),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull(),
  originalMessageId: text("original_message_id").notNull(),
  guildId: text("guild_id"),
  writeToDb: boolean("write_to_db").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
})

export const transcriptions = pgTable("transcriptions", {
  messageId: text("message_id").primaryKey(),
  threadId: text("thread_id"),
  replyMessageId: text("reply_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow()
})

export const autoTranscriptVoiceMessages = pgTable("auto_transcript_voice_messages", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
})

export const ignoredUsers = pgTable("ignored_users", {
  userId: text("user_id").primaryKey(),
  type: ignoreType("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
})

export type Job = typeof jobs.$inferSelect
