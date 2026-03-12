-- CreateTable
CREATE TABLE "InstituteVerificationRejection" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "documentField" TEXT NOT NULL,
    "customNote" TEXT,
    "verificationId" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,

    CONSTRAINT "InstituteVerificationRejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstituteVerificationRejection_instituteId_idx" ON "InstituteVerificationRejection"("instituteId");

-- CreateIndex
CREATE INDEX "InstituteVerificationRejection_verificationId_idx" ON "InstituteVerificationRejection"("verificationId");

-- AddForeignKey
ALTER TABLE "InstituteVerificationRejection" ADD CONSTRAINT "InstituteVerificationRejection_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "InstituteVerifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteVerificationRejection" ADD CONSTRAINT "InstituteVerificationRejection_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
