/*
  Warnings:

  - You are about to drop the column `userId` on the `Transactions` table. All the data in the column will be lost.
  - Added the required column `InstituteId` to the `Transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Transactions" DROP CONSTRAINT "Transactions_userId_fkey";

-- AlterTable
ALTER TABLE "Transactions" DROP COLUMN "userId",
ADD COLUMN     "InstituteId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_InstituteId_fkey" FOREIGN KEY ("InstituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
