/*
  Warnings:

  - You are about to drop the column `InstituteId` on the `Transactions` table. All the data in the column will be lost.
  - Added the required column `instituteId` to the `Transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Transactions" DROP CONSTRAINT "Transactions_InstituteId_fkey";

-- AlterTable
ALTER TABLE "Transactions" DROP COLUMN "InstituteId",
ADD COLUMN     "instituteId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
