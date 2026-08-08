-- CreateEnum
CREATE TYPE "Source" AS ENUM ('USER', 'CV_IMPORT', 'AI');

-- AlterTable
ALTER TABLE "Certification" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Education" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Experience" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Language" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "CvDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "sourceLanguage" TEXT,
    "model" TEXT,
    "draftJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CvDocument" ADD CONSTRAINT "CvDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
