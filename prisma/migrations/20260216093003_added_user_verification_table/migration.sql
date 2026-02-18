-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "UserVerifications" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" "UserRoles" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "governMentId" TEXT NOT NULL,
    "authorizeToVerify" BOOLEAN NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "professionalTitle" TEXT NOT NULL,
    "primarySpecialty" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiryDate" TIMESTAMP(3) NOT NULL,
    "degree" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "yearOfGraduation" TIMESTAMP(3) NOT NULL,
    "degreeCertificate" TEXT NOT NULL,
    "postGraduateDegree" TEXT,
    "postGraduateUniversity" TEXT,
    "postGraduateDegreeCertificate" TEXT,
    "currentEmployer" TEXT,
    "currentRole" TEXT,
    "practiceCountry" TEXT,
    "practiceCity" TEXT,
    "isLicenceSuspended" BOOLEAN NOT NULL DEFAULT false,
    "licenceSuspensionReason" TEXT,

    CONSTRAINT "UserVerifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserVerifications" ADD CONSTRAINT "UserVerifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
