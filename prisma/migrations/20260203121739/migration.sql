/*
  Warnings:

  - You are about to drop the column `specialization` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "specialization",
ADD COLUMN     "speciality" TEXT DEFAULT '',
ADD COLUMN     "subSpeciality" TEXT DEFAULT '';
