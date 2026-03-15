CREATE TYPE "ignore_type" AS ENUM ('context_menu', 'auto_transcription', 'all');
ALTER TABLE "ignored_users" ADD COLUMN "type" "ignore_type" NOT NULL DEFAULT 'all';
ALTER TABLE "ignored_users" ALTER COLUMN "type" DROP DEFAULT;
