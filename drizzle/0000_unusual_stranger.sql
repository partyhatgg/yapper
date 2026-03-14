CREATE TABLE "auto_transcript_voice_messages" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ignored_users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"attachment_url" text NOT NULL,
	"interaction_token" text,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"original_message_id" text NOT NULL,
	"guild_id" text,
	"write_to_db" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcriptions" (
	"message_id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"thread_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
