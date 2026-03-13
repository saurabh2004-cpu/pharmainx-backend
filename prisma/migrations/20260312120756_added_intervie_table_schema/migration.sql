-- CreateTable
CREATE TABLE "Interviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "interviewType" TEXT NOT NULL,
    "interviewTime" TIMESTAMP(3) NOT NULL,
    "interviewDate" TIMESTAMP(3) NOT NULL,
    "interviewLink" TEXT,

    CONSTRAINT "Interviews_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Interviews" ADD CONSTRAINT "Interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interviews" ADD CONSTRAINT "Interviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
