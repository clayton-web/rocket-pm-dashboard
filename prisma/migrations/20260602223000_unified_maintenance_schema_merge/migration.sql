-- CreateEnum
CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('new', 'triaged', 'dispatched', 'in_progress', 'awaiting_owner_approval', 'scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "MaintenanceUrgency" AS ENUM ('emergency', 'urgent', 'routine');

-- CreateEnum
CREATE TYPE "MaintenanceTrade" AS ENUM ('general', 'plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other');

-- CreateEnum
CREATE TYPE "MaintenanceRequestSource" AS ENUM ('tenant_portal', 'staff', 'public_intake', 'email_intake');

-- CreateEnum
CREATE TYPE "MaintenanceOwnerApprovalStatus" AS ENUM ('not_required', 'pending', 'approved', 'declined');

-- CreateEnum
CREATE TYPE "MaintenanceAttachmentKind" AS ENUM ('photo', 'video', 'document', 'other');

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "submittedByContactId" TEXT,
    "assignedToUserId" TEXT,
    "source" "MaintenanceRequestSource" NOT NULL DEFAULT 'tenant_portal',
    "category" TEXT,
    "trade" "MaintenanceTrade" NOT NULL,
    "urgency" "MaintenanceUrgency" NOT NULL DEFAULT 'routine',
    "status" "MaintenanceRequestStatus" NOT NULL DEFAULT 'new',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isHabitable" BOOLEAN,
    "accessNotes" TEXT,
    "triageSummary" TEXT,
    "guidedMeta" JSONB,
    "assignedVendorName" TEXT,
    "completionNote" TEXT,
    "ownerApprovalStatus" "MaintenanceOwnerApprovalStatus" NOT NULL DEFAULT 'not_required',
    "ownerApprovedAt" TIMESTAMP(3),
    "scheduledWorkAt" TIMESTAMP(3),
    "invoiceStorageKey" TEXT,
    "invoiceAmount" DECIMAL(12,2),
    "legacySupabaseId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceAttachment" (
    "id" TEXT NOT NULL,
    "maintenanceRequestId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT NOT NULL,
    "kind" "MaintenanceAttachmentKind" NOT NULL DEFAULT 'photo',
    "uploadedByContactId" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_legacySupabaseId_key" ON "MaintenanceRequest"("legacySupabaseId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_organizationId_idx" ON "MaintenanceRequest"("organizationId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_propertyId_idx" ON "MaintenanceRequest"("propertyId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_unitId_idx" ON "MaintenanceRequest"("unitId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_tenancyId_idx" ON "MaintenanceRequest"("tenancyId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_idx" ON "MaintenanceRequest"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_urgency_idx" ON "MaintenanceRequest"("urgency");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_trade_idx" ON "MaintenanceRequest"("trade");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_submittedByContactId_idx" ON "MaintenanceRequest"("submittedByContactId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_assignedToUserId_idx" ON "MaintenanceRequest"("assignedToUserId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_submittedAt_idx" ON "MaintenanceRequest"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAttachment_storageKey_key" ON "MaintenanceAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "MaintenanceAttachment_maintenanceRequestId_idx" ON "MaintenanceAttachment"("maintenanceRequestId");

-- CreateIndex
CREATE INDEX "MaintenanceAttachment_organizationId_idx" ON "MaintenanceAttachment"("organizationId");

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_submittedByContactId_fkey" FOREIGN KEY ("submittedByContactId") REFERENCES "TenancyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAttachment" ADD CONSTRAINT "MaintenanceAttachment_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAttachment" ADD CONSTRAINT "MaintenanceAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
