/*
  Warnings:

  - You are about to drop the `InstituteCredits` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "InstituteCredits" DROP CONSTRAINT "InstituteCredits_instituteId_fkey";

-- DropTable
DROP TABLE "InstituteCredits";

-- CreateTable
CREATE TABLE "CreditsWallet" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "newJobCreditsPrice" INTEGER NOT NULL DEFAULT 0,
    "renewJobCreditsPrice" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CreditsWallet_pkey" PRIMARY KEY ("id")
);
