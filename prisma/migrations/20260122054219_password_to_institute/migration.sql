/*
  Warnings:

  - A unique constraint covering the columns `[contactEmail]` on the table `Institute` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `password` to the `Institute` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Institute" ADD COLUMN     "password" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Institute_contactEmail_key" ON "Institute"("contactEmail");
