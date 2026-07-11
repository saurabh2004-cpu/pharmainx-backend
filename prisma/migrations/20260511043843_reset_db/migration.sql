-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityLogsModule" ADD VALUE 'INSTITUTE_IMAGES';
ALTER TYPE "ActivityLogsModule" ADD VALUE 'USER_IMAGES';
ALTER TYPE "ActivityLogsModule" ADD VALUE 'PACKAGES';

-- AlterTable
ALTER TABLE "ActivityLogs" ADD COLUMN     "instituteId" TEXT;

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "name" TEXT;

-- AddForeignKey
ALTER TABLE "ActivityLogs" ADD CONSTRAINT "ActivityLogs_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
