/*
  Warnings:

  - You are about to drop the `JobCredits` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "JobCredits" DROP CONSTRAINT "JobCredits_instituteId_fkey";

-- DropTable
DROP TABLE "JobCredits";

-- CreateTable
CREATE TABLE "InstituteCredits" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "instituteId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InstituteCredits_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstituteCredits" ADD CONSTRAINT "InstituteCredits_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
