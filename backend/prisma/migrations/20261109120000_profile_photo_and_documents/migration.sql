-- AlterTable
ALTER TABLE "Certification" ADD COLUMN     "documentMimeType" TEXT,
ADD COLUMN     "documentName" TEXT,
ADD COLUMN     "documentPath" TEXT,
ADD COLUMN     "showInCompactCv" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showInDocumentedCv" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Education" ADD COLUMN     "documentMimeType" TEXT,
ADD COLUMN     "documentName" TEXT,
ADD COLUMN     "documentPath" TEXT,
ADD COLUMN     "showInCompactCv" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showInDocumentedCv" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "photoMimeType" TEXT,
ADD COLUMN     "photoPath" TEXT;
