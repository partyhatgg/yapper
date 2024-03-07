-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('TEXT_COMMAND', 'APPLICATION_COMMAND');

-- CreateEnum
CREATE TYPE "InfrastructureUsed" AS ENUM ('SERVERLESS', 'ENDPOINT');

-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('ONCE', 'RECURRING');

-- CreateTable
CREATE TABLE "command_cooldowns" (
    "userId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "commandType" "CommandType" NOT NULL,

    CONSTRAINT "command_cooldowns_pkey" PRIMARY KEY ("commandName","commandType","userId")
);

-- CreateTable
CREATE TABLE "user_languages" (
    "userId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,

    CONSTRAINT "user_languages_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "transcriptions" (
    "initialMessageId" TEXT NOT NULL,
    "responseMessageId" TEXT NOT NULL,
    "threadId" TEXT,

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("initialMessageId")
);

-- CreateTable
CREATE TABLE "auto_transcript_voice_messages" (
    "guildId" TEXT NOT NULL,

    CONSTRAINT "auto_transcript_voice_messages_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "attachmentUrl" TEXT NOT NULL,
    "initialMessageId" TEXT NOT NULL,
    "responseMessageId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "infrastructureUsed" "InfrastructureUsed" NOT NULL,
    "channelId" TEXT NOT NULL,
    "interactionId" TEXT,
    "interactionToken" TEXT,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ignored_users" (
    "userId" TEXT NOT NULL,

    CONSTRAINT "ignored_users_pkey" PRIMARY KEY ("userId")
);
