-- CreateTable
CREATE TABLE "AdaptedCv" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobOfferId" TEXT,
    "jobMatchId" TEXT,
    "sourceLanguage" TEXT,
    "content" JSONB NOT NULL,
    "offerSnapshot" JSONB NOT NULL,
    "profileSnapshot" JSONB NOT NULL,
    "profileFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptedCv_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AdaptedCv" ADD CONSTRAINT "AdaptedCv_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptedCv" ADD CONSTRAINT "AdaptedCv_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptedCv" ADD CONSTRAINT "AdaptedCv_jobMatchId_fkey" FOREIGN KEY ("jobMatchId") REFERENCES "JobMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
