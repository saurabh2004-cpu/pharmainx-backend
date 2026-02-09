/*
  Warnings:

  - You are about to drop the column `instituteId` on the `CreditsWallet` table. All the data in the column will be lost.
  - You are about to drop the column `totalCredits` on the `CreditsWallet` table. All the data in the column will be lost.
  - You are about to drop the column `creditsWalletId` on the `Institute` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CreditsWallet" DROP CONSTRAINT "CreditsWallet_instituteId_fkey";

-- DropIndex
DROP INDEX "Institute_creditsWalletId_key";

-- AlterTable
ALTER TABLE "CreditsWallet" DROP COLUMN "instituteId",
DROP COLUMN "totalCredits";

-- AlterTable
ALTER TABLE "Institute" DROP COLUMN "creditsWalletId";

-- CreateTable
CREATE TABLE "InstituteCredits" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "instituteId" TEXT,

    CONSTRAINT "InstituteCredits_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstituteCredits" ADD CONSTRAINT "InstituteCredits_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
