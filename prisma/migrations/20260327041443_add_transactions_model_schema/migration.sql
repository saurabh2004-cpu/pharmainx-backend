/*
  Warnings:

  - Added the required column `packageId` to the `Transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transactions" ADD COLUMN     "packageId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
