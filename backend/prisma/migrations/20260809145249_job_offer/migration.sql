-- CreateEnum
CREATE TYPE "JobLevel" AS ENUM ('Junior', 'Mid', 'Senior', 'Lead', 'Executive');

-- CreateEnum
CREATE TYPE "InputType" AS ENUM ('TEXT', 'PDF', 'IMAGE');

-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "level" "JobLevel",
    "responsibilities" TEXT[],
    "requiredSkills" TEXT[],
    "preferredSkills" TEXT[],
    "experienceYears" INTEGER,
    "experienceSummary" TEXT,
    "education" TEXT[],
    "languages" TEXT[],
    "keywords" TEXT[],
    "sourceLanguage" TEXT,
    "inputType" "InputType" NOT NULL DEFAULT 'TEXT',
    "rawInput" TEXT,
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
