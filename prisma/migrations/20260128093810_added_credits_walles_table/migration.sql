/*
  Warnings:

  - A unique constraint covering the columns `[creditsWalletId]` on the table `Institute` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Institute" ADD COLUMN     "creditsWalletId" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "renewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Institute_creditsWalletId_key" ON "Institute"("creditsWalletId");

-- AddForeignKey
ALTER TABLE "Institute" ADD CONSTRAINT "Institute_creditsWalletId_fkey" FOREIGN KEY ("creditsWalletId") REFERENCES "CreditsWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
