-- AlterTable
ALTER TABLE "JobMatch" ADD COLUMN     "aiScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coverage" INTEGER,
ADD COLUMN     "scoringVersion" INTEGER NOT NULL DEFAULT 1;

-- Backfill: los matches previos no tenían cobertura; su único score era el de la IA.
UPDATE "JobMatch" SET "aiScore" = "overallScore";
