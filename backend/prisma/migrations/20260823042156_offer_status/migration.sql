-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'APPLIED', 'OMITTED');

-- AlterTable
ALTER TABLE "JobOffer" ADD COLUMN     "status" "OfferStatus" NOT NULL DEFAULT 'PENDING';
