-- CreateTable
CREATE TABLE "JobInactiveReason" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "JobInactiveReason_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobInactiveReason" ADD CONSTRAINT "JobInactiveReason_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
