/*
  Warnings:

  - You are about to drop the column `relatedApplicationId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `relatedJobId` on the `Notification` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_relatedApplicationId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_relatedJobId_fkey";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "relatedApplicationId",
DROP COLUMN "relatedJobId",
ADD COLUMN     "applicationId" TEXT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
