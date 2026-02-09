/*
  Warnings:

  - A unique constraint covering the columns `[instituteId,userId]` on the table `InstituteView` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "InstituteView_instituteId_userId_key" ON "InstituteView"("instituteId", "userId");
