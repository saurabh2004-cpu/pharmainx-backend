-- CreateTable
CREATE TABLE "UserVerificationRejection" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "documentField" TEXT NOT NULL,
    "reasonId" TEXT NOT NULL,
    "customNote" TEXT,
    "verificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserVerificationRejection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RejectionReason" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reasonText" TEXT NOT NULL,
    "applicableToDoc" TEXT,

    CONSTRAINT "RejectionReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserVerificationRejection_userId_idx" ON "UserVerificationRejection"("userId");

-- CreateIndex
CREATE INDEX "UserVerificationRejection_verificationId_idx" ON "UserVerificationRejection"("verificationId");

-- CreateIndex
CREATE UNIQUE INDEX "RejectionReason_reasonText_key" ON "RejectionReason"("reasonText");

-- AddForeignKey
ALTER TABLE "UserVerificationRejection" ADD CONSTRAINT "UserVerificationRejection_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "RejectionReason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVerificationRejection" ADD CONSTRAINT "UserVerificationRejection_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "UserVerifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVerificationRejection" ADD CONSTRAINT "UserVerificationRejection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
