/*
  Warnings:

  - A unique constraint covering the columns `[instituteId]` on the table `InstituteVerifications` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "InstituteVerifications" ALTER COLUMN "adminPhone" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InstituteVerifications_instituteId_key" ON "InstituteVerifications"("instituteId");
