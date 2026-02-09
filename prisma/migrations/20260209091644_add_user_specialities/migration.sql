-- CreateTable
CREATE TABLE "UserSpecialities" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "specialities" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "UserSpecialities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserSpecialities" ADD CONSTRAINT "UserSpecialities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
