/*
  Warnings:

  - You are about to drop the column `instituteId` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the `UserFeedbacks` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('USER', 'INSTITUTE', 'ADMIN', 'SUPER_ADMIN');

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_instituteId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserFeedbacks" DROP CONSTRAINT "UserFeedbacks_userId_fkey";

-- DropIndex
DROP INDEX "Conversation_instituteId_idx";

-- DropIndex
DROP INDEX "Conversation_instituteId_userId_key";

-- DropIndex
DROP INDEX "Conversation_userId_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "instituteId",
DROP COLUMN "userId";

-- DropTable
DROP TABLE "UserFeedbacks";

-- DropEnum
DROP TYPE "FeedbackType";

-- CreateTable
CREATE TABLE "ConversationParticipants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "participantType" "ParticipantType" NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "ConversationParticipants_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConversationParticipants" ADD CONSTRAINT "ConversationParticipants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
