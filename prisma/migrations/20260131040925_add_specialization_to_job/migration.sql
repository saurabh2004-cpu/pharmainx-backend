/*
  Warnings:

  - You are about to drop the `Specialty` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_InstituteSpecialties` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_JobSpecialties` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_UserSpecialties` table. If the table is not empty, all the data it contains will be lost.

*/
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
ALTER TABLE "Job" ADD COLUMN     "specialization" TEXT DEFAULT '';

-- DropTable
DROP TABLE "Specialty";

-- DropTable
DROP TABLE "_InstituteSpecialties";

-- DropTable
DROP TABLE "_JobSpecialties";

-- DropTable
DROP TABLE "_UserSpecialties";
