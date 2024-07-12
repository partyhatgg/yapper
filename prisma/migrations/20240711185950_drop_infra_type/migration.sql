/*
  Warnings:

  - You are about to drop the column `infrastructureUsed` on the `jobs` table. All the data in the column will be lost.
  - Added the required column `model` to the `jobs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "infrastructureUsed",
ADD COLUMN     "model" TEXT NOT NULL;

-- DropEnum
DROP TYPE "InfrastructureUsed";
