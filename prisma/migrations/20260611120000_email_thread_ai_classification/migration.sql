-- AlterTable
ALTER TABLE "EmailThread"
  ADD COLUMN "categoryConfidence" DOUBLE PRECISION,
  ADD COLUMN "categoryAiReason" TEXT;
