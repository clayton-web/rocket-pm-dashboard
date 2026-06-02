-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('new', 'archived');

-- CreateEnum
CREATE TYPE "ShowingStatus" AS ENUM ('scheduled', 'completed', 'no_show', 'cancelled');

-- CreateEnum
CREATE TYPE "ShowingOutcome" AS ENUM ('interested', 'not_interested', 'no_show', 'reschedule');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('not_contacted', 'contacted');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "TenancyStatus" AS ENUM ('pending_move_in', 'active', 'notice_received', 'move_out_scheduled', 'ended', 'archived');

-- CreateEnum
CREATE TYPE "RetentionStatus" AS ENUM ('archived', 'pending_review', 'converted_to_client', 'scheduled_for_deletion', 'deleted');

-- CreateEnum
CREATE TYPE "TenancyContactType" AS ENUM ('tenant', 'co_tenant', 'occupant', 'emergency_contact');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showing" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "assignedToUserId" TEXT,
    "createdByUserId" TEXT,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3),
    "status" "ShowingStatus" NOT NULL DEFAULT 'scheduled',
    "showingOutcome" "ShowingOutcome",
    "contactStatus" "ContactStatus" NOT NULL DEFAULT 'not_contacted',
    "contactNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Showing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "prospectId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "currentAddress" TEXT,
    "desiredMoveInDate" DATE,
    "occupantCount" INTEGER,
    "monthlyIncome" DECIMAL(12,2),
    "hasPets" BOOLEAN NOT NULL DEFAULT false,
    "petDetails" TEXT,
    "smokerStatus" TEXT,
    "employerName" TEXT,
    "jobTitle" TEXT,
    "employmentNotes" TEXT,
    "consentCreditCheck" BOOLEAN NOT NULL DEFAULT false,
    "consentSignatureName" TEXT,
    "consentSignedAt" TIMESTAMP(3),
    "consentIpAddress" VARCHAR(45),
    "consentUserAgent" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "documentKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "TenancyStatus" NOT NULL DEFAULT 'pending_move_in',
    "leaseStartDate" DATE NOT NULL,
    "leaseEndDate" DATE,
    "moveInDate" DATE NOT NULL,
    "moveOutDate" DATE,
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "securityDeposit" DECIMAL(12,2) NOT NULL,
    "petDeposit" DECIMAL(12,2),
    "buildiumResidentCenterUrl" TEXT,
    "archivedAt" TIMESTAMP(3),
    "retentionReviewDueAt" TIMESTAMP(3),
    "retentionStatus" "RetentionStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyContact" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "contactType" "TenancyContactType" NOT NULL,
    "portalAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "tenancyId" TEXT NOT NULL,
    "noticeType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "serviceMethod" TEXT,
    "servedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prospect_propertyId_idx" ON "Prospect"("propertyId");

-- CreateIndex
CREATE INDEX "Prospect_email_idx" ON "Prospect"("email");

-- CreateIndex
CREATE INDEX "Prospect_propertyId_email_idx" ON "Prospect"("propertyId", "email");

-- CreateIndex
CREATE INDEX "Showing_prospectId_idx" ON "Showing"("prospectId");

-- CreateIndex
CREATE INDEX "Showing_propertyId_idx" ON "Showing"("propertyId");

-- CreateIndex
CREATE INDEX "Showing_assignedToUserId_idx" ON "Showing"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Showing_scheduledStart_idx" ON "Showing"("scheduledStart");

-- CreateIndex
CREATE INDEX "Application_propertyId_idx" ON "Application"("propertyId");

-- CreateIndex
CREATE INDEX "Application_unitId_idx" ON "Application"("unitId");

-- CreateIndex
CREATE INDEX "Application_email_idx" ON "Application"("email");

-- CreateIndex
CREATE INDEX "Application_propertyId_email_idx" ON "Application"("propertyId", "email");

-- CreateIndex
CREATE INDEX "Application_prospectId_idx" ON "Application"("prospectId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_submittedAt_idx" ON "Application"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_storageKey_key" ON "ApplicationDocument"("storageKey");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationDocument_propertyId_idx" ON "ApplicationDocument"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenancy_applicationId_key" ON "Tenancy"("applicationId");

-- CreateIndex
CREATE INDEX "Tenancy_propertyId_idx" ON "Tenancy"("propertyId");

-- CreateIndex
CREATE INDEX "Tenancy_unitId_idx" ON "Tenancy"("unitId");

-- CreateIndex
CREATE INDEX "Tenancy_status_idx" ON "Tenancy"("status");

-- CreateIndex
CREATE INDEX "Tenancy_archivedAt_idx" ON "Tenancy"("archivedAt");

-- CreateIndex
CREATE INDEX "Tenancy_retentionReviewDueAt_idx" ON "Tenancy"("retentionReviewDueAt");

-- CreateIndex
CREATE INDEX "Tenancy_retentionStatus_idx" ON "Tenancy"("retentionStatus");

-- CreateIndex
CREATE INDEX "TenancyContact_tenancyId_idx" ON "TenancyContact"("tenancyId");

-- CreateIndex
CREATE INDEX "TenancyContact_email_idx" ON "TenancyContact"("email");

-- CreateIndex
CREATE INDEX "TenancyContact_tenancyId_email_idx" ON "TenancyContact"("tenancyId", "email");

-- CreateIndex
CREATE INDEX "Notice_propertyId_idx" ON "Notice"("propertyId");

-- CreateIndex
CREATE INDEX "Notice_unitId_idx" ON "Notice"("unitId");

-- CreateIndex
CREATE INDEX "Notice_tenancyId_idx" ON "Notice"("tenancyId");

-- CreateIndex
CREATE INDEX "Notice_servedAt_idx" ON "Notice"("servedAt");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyContact" ADD CONSTRAINT "TenancyContact_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
