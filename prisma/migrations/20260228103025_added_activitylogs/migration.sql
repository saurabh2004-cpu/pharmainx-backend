-- CreateEnum
CREATE TYPE "ActivityActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ActivityLogsModule" AS ENUM ('USER', 'INSTITUTE', 'JOB', 'SAVED_JOB', 'APPLICATION', 'CREDITS_WALLET', 'INSTITUTE_VERIFICATIONS', 'USER_VERIFICATIONS', 'INSTITUTE_CREDITS');

-- CreateTable
CREATE TABLE "ActivityLogs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" "ActivityLogsModule" NOT NULL,
    "action" "ActivityActionType" NOT NULL,
    "recordId" TEXT NOT NULL,
    "performedBy" TEXT,
    "description" TEXT,
    "oldData" JSONB,
    "newData" JSONB,

    CONSTRAINT "ActivityLogs_pkey" PRIMARY KEY ("id")
);
