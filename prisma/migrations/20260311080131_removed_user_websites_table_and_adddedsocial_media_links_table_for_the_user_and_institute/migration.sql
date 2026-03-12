/*
  Warnings:

  - You are about to drop the `UserLinks` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SocialMediaPlatforms" AS ENUM ('TWITTER', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK');

-- DropForeignKey
ALTER TABLE "UserLinks" DROP CONSTRAINT "UserLinks_userId_fkey";

-- DropTable
DROP TABLE "UserLinks";

-- CreateTable
CREATE TABLE "UserSocialMediaLinks" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "link" TEXT NOT NULL DEFAULT '',
    "platform" "SocialMediaPlatforms" NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "UserSocialMediaLinks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteSocialMediaLinks" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "link" TEXT NOT NULL DEFAULT '',
    "platform" "SocialMediaPlatforms" NOT NULL,
    "instituteId" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "InstituteSocialMediaLinks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserSocialMediaLinks" ADD CONSTRAINT "UserSocialMediaLinks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteSocialMediaLinks" ADD CONSTRAINT "InstituteSocialMediaLinks_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
