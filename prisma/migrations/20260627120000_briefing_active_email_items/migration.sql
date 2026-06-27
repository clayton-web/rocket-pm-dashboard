-- CreateEnum
CREATE TYPE "BriefingAttentionStatus" AS ENUM ('ACTIVE', 'REPLIED', 'FORWARDED', 'REVIEWED', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BriefingAttentionLabel" AS ENUM ('NEW', 'STILL_ACTIVE', 'REPLIED', 'FORWARDED', 'REVIEWED', 'RESOLVED');

-- AlterTable
ALTER TABLE "BriefingItem" ADD COLUMN     "attentionLabel" "BriefingAttentionLabel" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "attentionSection" TEXT,
ADD COLUMN     "emailThreadBriefingAttentionId" TEXT;

-- CreateTable
CREATE TABLE "EmailThreadBriefingAttention" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "emailThreadId" TEXT NOT NULL,
    "status" "BriefingAttentionStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstSurfacedAt" TIMESTAMP(3) NOT NULL,
    "lastSurfacedRunId" TEXT,
    "lastSurfacedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionReason" TEXT,
    "summaryTitle" TEXT NOT NULL,
    "category" "BriefingItemCategory" NOT NULL,
    "urgency" "BriefingItemUrgency" NOT NULL,
    "subject" TEXT,
    "summaryJson" JSONB,
    "surfacedAtOutboundCount" INTEGER NOT NULL DEFAULT 0,
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThreadBriefingAttention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BriefingItem_emailThreadBriefingAttentionId_idx" ON "BriefingItem"("emailThreadBriefingAttentionId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThreadBriefingAttention_organizationId_emailThreadId_key" ON "EmailThreadBriefingAttention"("organizationId", "emailThreadId");

-- CreateIndex
CREATE INDEX "EmailThreadBriefingAttention_organizationId_status_idx" ON "EmailThreadBriefingAttention"("organizationId", "status");

-- CreateIndex
CREATE INDEX "EmailThreadBriefingAttention_emailThreadId_idx" ON "EmailThreadBriefingAttention"("emailThreadId");

-- AddForeignKey
ALTER TABLE "BriefingItem" ADD CONSTRAINT "BriefingItem_emailThreadBriefingAttentionId_fkey" FOREIGN KEY ("emailThreadBriefingAttentionId") REFERENCES "EmailThreadBriefingAttention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThreadBriefingAttention" ADD CONSTRAINT "EmailThreadBriefingAttention_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThreadBriefingAttention" ADD CONSTRAINT "EmailThreadBriefingAttention_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThreadBriefingAttention" ADD CONSTRAINT "EmailThreadBriefingAttention_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
