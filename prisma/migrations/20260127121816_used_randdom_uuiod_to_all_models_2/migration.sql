-- CreateEnum
CREATE TYPE "AuthRoles" AS ENUM ('USER', 'INSTITUTE');

-- CreateTable
CREATE TABLE "Auth" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "AuthRoles" NOT NULL DEFAULT 'USER',

    CONSTRAINT "Auth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Auth_email_key" ON "Auth"("email");
