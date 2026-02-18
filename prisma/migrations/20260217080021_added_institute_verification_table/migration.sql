-- CreateTable
CREATE TABLE "InstituteVerifications" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "instituteId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "telephone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "adminPhone" BOOLEAN NOT NULL,
    "registrationCertificate" TEXT NOT NULL,

    CONSTRAINT "InstituteVerifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstituteVerifications" ADD CONSTRAINT "InstituteVerifications_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
