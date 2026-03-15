ALTER TABLE "ignored_users" ADD COLUMN IF NOT EXISTS "type" "ignore_type" NOT NULL DEFAULT 'ALL';
ALTER TABLE "ignored_users" ALTER COLUMN "type" DROP DEFAULT;
