-- CreateEnum
CREATE TYPE "CreditHistoryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "CreditHistoryAction" AS ENUM ('JOB_POSTED', 'JOB_RENEWED', 'JOB_DELETED', 'JOB_EDITED', 'CREDITS_PURCHASED');

-- CreateTable
CREATE TABLE "CreditsHistory" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "type" "CreditHistoryType" NOT NULL DEFAULT 'DEBIT',
    "action" "CreditHistoryAction" NOT NULL DEFAULT 'JOB_POSTED',
    "jobId" TEXT,
    "instituteId" TEXT,

    CONSTRAINT "CreditsHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CreditsHistory" ADD CONSTRAINT "CreditsHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditsHistory" ADD CONSTRAINT "CreditsHistory_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
