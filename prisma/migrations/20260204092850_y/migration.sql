-- CreateTable
CREATE TABLE "InstituteView" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "userId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstituteView_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstituteView" ADD CONSTRAINT "InstituteView_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
