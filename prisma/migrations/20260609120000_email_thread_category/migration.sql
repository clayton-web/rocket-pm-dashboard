-- CreateEnum
CREATE TYPE "EmailThreadCategory" AS ENUM (
  'LANDLORD_COMMUNICATION',
  'TENANT_COMMUNICATION',
  'STRATA',
  'TENANT_INQUIRY',
  'UNCATEGORIZED'
);

-- AlterTable
ALTER TABLE "EmailThread"
  ADD COLUMN "category" "EmailThreadCategory" NOT NULL DEFAULT 'UNCATEGORIZED',
  ADD COLUMN "categorySource" TEXT,
  ADD COLUMN "categoryUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EmailThread_organizationId_category_lastMessageAt_idx"
  ON "EmailThread"("organizationId", "category", "lastMessageAt");
