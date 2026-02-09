-- AlterEnum
ALTER TYPE "UserRoles" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "speciality" TEXT,
ADD COLUMN     "subSpeciality" TEXT;
