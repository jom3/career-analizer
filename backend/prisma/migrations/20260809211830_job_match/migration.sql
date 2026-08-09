-- CreateTable
CREATE TABLE "JobMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobOfferId" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'es',
    "overallScore" INTEGER NOT NULL,
    "overallJustification" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "offerSnapshot" JSONB NOT NULL,
    "profileSnapshot" JSONB NOT NULL,
    "profileFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
