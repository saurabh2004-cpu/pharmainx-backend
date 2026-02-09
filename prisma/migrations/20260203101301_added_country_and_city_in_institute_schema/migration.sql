/*
  Warnings:

  - You are about to drop the column `location` on the `Institute` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Institute" DROP COLUMN "location",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT;
