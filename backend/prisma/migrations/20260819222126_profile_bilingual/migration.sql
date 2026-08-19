-- AlterTable
ALTER TABLE "Certification" ADD COLUMN     "issuerEn" TEXT,
ADD COLUMN     "issuerEs" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameEs" TEXT;

-- AlterTable
ALTER TABLE "Education" ADD COLUMN     "degreeEn" TEXT,
ADD COLUMN     "degreeEs" TEXT,
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "descriptionEs" TEXT,
ADD COLUMN     "fieldEn" TEXT,
ADD COLUMN     "fieldEs" TEXT,
ADD COLUMN     "institutionEn" TEXT,
ADD COLUMN     "institutionEs" TEXT;

-- AlterTable
ALTER TABLE "Experience" ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "descriptionEs" TEXT,
ADD COLUMN     "locationEn" TEXT,
ADD COLUMN     "locationEs" TEXT,
ADD COLUMN     "metricsEn" TEXT[],
ADD COLUMN     "metricsEs" TEXT[],
ADD COLUMN     "positionEn" TEXT,
ADD COLUMN     "positionEs" TEXT;

-- AlterTable
ALTER TABLE "Language" ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameEs" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "headlineEn" TEXT,
ADD COLUMN     "headlineEs" TEXT,
ADD COLUMN     "locationEn" TEXT,
ADD COLUMN     "locationEs" TEXT,
ADD COLUMN     "summaryEn" TEXT,
ADD COLUMN     "summaryEs" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "descriptionEs" TEXT,
ADD COLUMN     "metricsEn" TEXT[],
ADD COLUMN     "metricsEs" TEXT[],
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameEs" TEXT,
ADD COLUMN     "roleEn" TEXT,
ADD COLUMN     "roleEs" TEXT;
