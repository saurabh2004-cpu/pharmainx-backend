/*
  Warnings:

  - You are about to drop the column `reasonId` on the `UserVerificationRejection` table. All the data in the column will be lost.
  - You are about to drop the `RejectionReason` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserVerificationRejection" DROP CONSTRAINT "UserVerificationRejection_reasonId_fkey";

-- AlterTable
ALTER TABLE "UserVerificationRejection" DROP COLUMN "reasonId";

-- DropTable
DROP TABLE "RejectionReason";
