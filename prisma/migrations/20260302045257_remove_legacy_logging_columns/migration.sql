/*
  Warnings:

  - You are about to drop the column `performedBy` on the `ActivityLogs` table. All the data in the column will be lost.
  - You are about to drop the column `recordId` on the `ActivityLogs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ActivityLogs" DROP COLUMN "performedBy",
DROP COLUMN "recordId";
