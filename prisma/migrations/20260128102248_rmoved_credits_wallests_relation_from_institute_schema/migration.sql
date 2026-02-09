-- DropForeignKey
ALTER TABLE "Institute" DROP CONSTRAINT "Institute_creditsWalletId_fkey";

-- AlterTable
ALTER TABLE "CreditsWallet" ADD COLUMN     "instituteId" TEXT;

-- AddForeignKey
ALTER TABLE "CreditsWallet" ADD CONSTRAINT "CreditsWallet_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
