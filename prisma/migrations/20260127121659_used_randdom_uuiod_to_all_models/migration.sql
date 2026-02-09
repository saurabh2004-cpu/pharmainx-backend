/*
  Warnings:

  - The primary key for the `Application` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Institute` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Job` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `JobView` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Specialty` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_InstituteSpecialties` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_JobSpecialties` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_UserSpecialties` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `Auth` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_jobId_fkey";

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_userId_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_instituteId_fkey";

-- DropForeignKey
ALTER TABLE "JobView" DROP CONSTRAINT "JobView_jobId_fkey";

-- DropForeignKey
ALTER TABLE "_InstituteSpecialties" DROP CONSTRAINT "_InstituteSpecialties_A_fkey";

-- DropForeignKey
ALTER TABLE "_InstituteSpecialties" DROP CONSTRAINT "_InstituteSpecialties_B_fkey";

-- DropForeignKey
ALTER TABLE "_JobSpecialties" DROP CONSTRAINT "_JobSpecialties_A_fkey";

-- DropForeignKey
ALTER TABLE "_JobSpecialties" DROP CONSTRAINT "_JobSpecialties_B_fkey";

-- DropForeignKey
ALTER TABLE "_UserSpecialties" DROP CONSTRAINT "_UserSpecialties_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserSpecialties" DROP CONSTRAINT "_UserSpecialties_B_fkey";

-- AlterTable
ALTER TABLE "Application" DROP CONSTRAINT "Application_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "jobId" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Application_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Application_id_seq";

-- AlterTable
ALTER TABLE "Institute" DROP CONSTRAINT "Institute_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Institute_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Institute_id_seq";

-- AlterTable
ALTER TABLE "Job" DROP CONSTRAINT "Job_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "instituteId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Job_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Job_id_seq";

-- AlterTable
ALTER TABLE "JobView" DROP CONSTRAINT "JobView_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "jobId" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "JobView_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "JobView_id_seq";

-- AlterTable
ALTER TABLE "Specialty" DROP CONSTRAINT "Specialty_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Specialty_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- AlterTable
ALTER TABLE "_InstituteSpecialties" DROP CONSTRAINT "_InstituteSpecialties_AB_pkey",
ALTER COLUMN "A" SET DATA TYPE TEXT,
ALTER COLUMN "B" SET DATA TYPE TEXT,
ADD CONSTRAINT "_InstituteSpecialties_AB_pkey" PRIMARY KEY ("A", "B");

-- AlterTable
ALTER TABLE "_JobSpecialties" DROP CONSTRAINT "_JobSpecialties_AB_pkey",
ALTER COLUMN "A" SET DATA TYPE TEXT,
ALTER COLUMN "B" SET DATA TYPE TEXT,
ADD CONSTRAINT "_JobSpecialties_AB_pkey" PRIMARY KEY ("A", "B");

-- AlterTable
ALTER TABLE "_UserSpecialties" DROP CONSTRAINT "_UserSpecialties_AB_pkey",
ALTER COLUMN "A" SET DATA TYPE TEXT,
ALTER COLUMN "B" SET DATA TYPE TEXT,
ADD CONSTRAINT "_UserSpecialties_AB_pkey" PRIMARY KEY ("A", "B");

-- DropTable
DROP TABLE "Auth";

-- DropEnum
DROP TYPE "AuthRoles";

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobView" ADD CONSTRAINT "JobView_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstituteSpecialties" ADD CONSTRAINT "_InstituteSpecialties_A_fkey" FOREIGN KEY ("A") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstituteSpecialties" ADD CONSTRAINT "_InstituteSpecialties_B_fkey" FOREIGN KEY ("B") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobSpecialties" ADD CONSTRAINT "_JobSpecialties_A_fkey" FOREIGN KEY ("A") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobSpecialties" ADD CONSTRAINT "_JobSpecialties_B_fkey" FOREIGN KEY ("B") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserSpecialties" ADD CONSTRAINT "_UserSpecialties_A_fkey" FOREIGN KEY ("A") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserSpecialties" ADD CONSTRAINT "_UserSpecialties_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
