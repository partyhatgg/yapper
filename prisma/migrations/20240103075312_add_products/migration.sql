/*
  Warnings:

  - Added the required column `maxGuilds` to the `premium_users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('ONCE', 'RECURRING');

-- AlterTable
ALTER TABLE "premium_users" ADD COLUMN     "maxGuilds" INTEGER NOT NULL,
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PremiumPurchase" (
    "purchaseId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PremiumPurchase_pkey" PRIMARY KEY ("purchaseId")
);

-- CreateTable
CREATE TABLE "premium_products" (
    "id" TEXT NOT NULL,
    "maxGuilds" INTEGER NOT NULL,
    "price" BIGINT,
    "type" "PurchaseType" NOT NULL,

    CONSTRAINT "premium_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PremiumPurchase_userId_key" ON "PremiumPurchase"("userId");

-- AddForeignKey
ALTER TABLE "PremiumPurchase" ADD CONSTRAINT "PremiumPurchase_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "premium_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumPurchase" ADD CONSTRAINT "PremiumPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "premium_users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
