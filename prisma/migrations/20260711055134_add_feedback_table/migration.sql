-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('JOB_LOOKING', 'FEATURE', 'CHAT');

-- AlterEnum
ALTER TYPE "ActivityLogsModule" ADD VALUE 'USER_FEEDBACKS';

-- CreateTable
CREATE TABLE "UserFeedbacks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "feedbackType" "FeedbackType" NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeedbacks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserFeedbacks" ADD CONSTRAINT "UserFeedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
