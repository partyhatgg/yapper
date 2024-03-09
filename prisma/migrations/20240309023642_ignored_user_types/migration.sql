/*
  Warnings:

  - Added the required column `type` to the `ignored_users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IgnoreType" AS ENUM ('CONTEXT_MENU', 'AUTO_TRANSCRIPTION', 'ALL');

-- AlterTable
ALTER TABLE "ignored_users" ADD COLUMN     "type" "IgnoreType" NOT NULL;
