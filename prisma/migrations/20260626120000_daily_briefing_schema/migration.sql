-- CreateEnum
CREATE TYPE "BriefingSourceType" AS ENUM ('EMAIL', 'MAINTENANCE', 'RENT_PAYMENT', 'DEPOSIT', 'APPLICATION', 'VIEWING_REQUEST', 'INSPECTION', 'NOTICE', 'MOVE_OUT', 'VACANCY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BriefingSlot" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "BriefingRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "BriefingItemCategory" AS ENUM ('URGENT', 'LANDLORD', 'TENANT', 'MAINTENANCE', 'RENT_DEPOSIT', 'STRATA', 'GENERAL_ADMIN');

-- CreateEnum
CREATE TYPE "BriefingItemUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "OrganizationAiPolicy"
  ADD COLUMN "autoBriefingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxBriefingRunsPerDay" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "maxBriefingGeminiCallsPerRun" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "BriefingSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "morningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "afternoonEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/Vancouver',
    "morningLocalTime" TEXT NOT NULL DEFAULT '07:00',
    "afternoonLocalTime" TEXT NOT NULL DEFAULT '14:00',
    "emailRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activeSourceTypes" "BriefingSourceType"[] DEFAULT ARRAY['EMAIL']::"BriefingSourceType"[],
    "autoSyncBeforeBriefing" BOOLEAN NOT NULL DEFAULT true,
    "lookbackHours" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slot" "BriefingSlot" NOT NULL,
    "status" "BriefingRunStatus" NOT NULL DEFAULT 'PENDING',
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "executiveSummary" TEXT,
    "estimatedReadingMinutes" INTEGER,
    "threadsScanned" INTEGER NOT NULL DEFAULT 0,
    "itemsIncluded" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "geminiCallCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceNote" TEXT,
    "briefingJson" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "backgroundJobId" TEXT,
    "errorMessage" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingItem" (
    "id" TEXT NOT NULL,
    "briefingRunId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "BriefingSourceType" NOT NULL,
    "category" "BriefingItemCategory" NOT NULL,
    "urgency" "BriefingItemUrgency" NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT,
    "summaryTitle" TEXT NOT NULL,
    "summaryJson" JSONB,
    "emailThreadId" TEXT,
    "emailMessageId" TEXT,
    "providerThreadId" TEXT,
    "providerMessageId" TEXT,
    "sourceRecordId" TEXT,
    "sourceRecordType" TEXT,
    "dueDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BriefingSettings_organizationId_key" ON "BriefingSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingRun_backgroundJobId_key" ON "BriefingRun"("backgroundJobId");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingRun_organizationId_slot_windowEnd_key" ON "BriefingRun"("organizationId", "slot", "windowEnd");

-- CreateIndex
CREATE INDEX "BriefingRun_organizationId_createdAt_idx" ON "BriefingRun"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "BriefingRun_organizationId_slot_createdAt_idx" ON "BriefingRun"("organizationId", "slot", "createdAt");

-- CreateIndex
CREATE INDEX "BriefingItem_briefingRunId_urgency_sortOrder_idx" ON "BriefingItem"("briefingRunId", "urgency", "sortOrder");

-- CreateIndex
CREATE INDEX "BriefingItem_briefingRunId_category_idx" ON "BriefingItem"("briefingRunId", "category");

-- CreateIndex
CREATE INDEX "BriefingItem_organizationId_sourceType_idx" ON "BriefingItem"("organizationId", "sourceType");

-- CreateIndex
CREATE INDEX "BriefingItem_emailThreadId_idx" ON "BriefingItem"("emailThreadId");

-- AddForeignKey
ALTER TABLE "BriefingSettings" ADD CONSTRAINT "BriefingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingRun" ADD CONSTRAINT "BriefingRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingRun" ADD CONSTRAINT "BriefingRun_backgroundJobId_fkey" FOREIGN KEY ("backgroundJobId") REFERENCES "BackgroundJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingRun" ADD CONSTRAINT "BriefingRun_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingItem" ADD CONSTRAINT "BriefingItem_briefingRunId_fkey" FOREIGN KEY ("briefingRunId") REFERENCES "BriefingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingItem" ADD CONSTRAINT "BriefingItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingItem" ADD CONSTRAINT "BriefingItem_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingItem" ADD CONSTRAINT "BriefingItem_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
