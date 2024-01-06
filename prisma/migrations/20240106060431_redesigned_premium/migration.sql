/*
  Warnings:

  - You are about to drop the column `maxGuilds` on the `premium_users` table. All the data in the column will be lost.
  - You are about to drop the `PremiumPurchase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `premium_products` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `subscriptionId` to the `premium_users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PremiumPurchase" DROP CONSTRAINT "PremiumPurchase_priceId_fkey";

-- DropForeignKey
ALTER TABLE "PremiumPurchase" DROP CONSTRAINT "PremiumPurchase_userId_fkey";

-- AlterTable
ALTER TABLE "premium_users" DROP COLUMN "maxGuilds",
ADD COLUMN     "subscriptionId" TEXT NOT NULL;

-- DropTable
DROP TABLE "PremiumPurchase";

-- DropTable
DROP TABLE "premium_products";
