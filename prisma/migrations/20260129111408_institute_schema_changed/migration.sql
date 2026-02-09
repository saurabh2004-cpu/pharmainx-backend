/*
  Warnings:

  - Added the required column `bedsCount` to the `Institute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `staffCount` to the `Institute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `telephone` to the `Institute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Institute` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Institute" ADD COLUMN     "bedsCount" INTEGER NOT NULL,
ADD COLUMN     "services" TEXT[],
ADD COLUMN     "staffCount" INTEGER NOT NULL,
ADD COLUMN     "telephone" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;
