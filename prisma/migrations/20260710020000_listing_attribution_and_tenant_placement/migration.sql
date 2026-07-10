-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "rentalListingId" TEXT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN "rentalListingId" TEXT;

-- CreateEnum
CREATE TYPE "TenantPlacementStatus" AS ENUM ('completed', 'cancelled');

-- CreateTable
CREATE TABLE "TenantPlacement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "rentalListingId" TEXT,
    "status" "TenantPlacementStatus" NOT NULL DEFAULT 'completed',
    "leaseStartDate" DATE NOT NULL,
    "leaseEndDate" DATE,
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "landlordHandoffNotes" TEXT,
    "internalNotes" TEXT,
    "completedByUserId" TEXT,
    "rentalListingClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantPlacement_applicationId_key" ON "TenantPlacement"("applicationId");

-- CreateIndex
CREATE INDEX "TenantPlacement_organizationId_idx" ON "TenantPlacement"("organizationId");

-- CreateIndex
CREATE INDEX "TenantPlacement_propertyId_idx" ON "TenantPlacement"("propertyId");

-- CreateIndex
CREATE INDEX "TenantPlacement_unitId_idx" ON "TenantPlacement"("unitId");

-- CreateIndex
CREATE INDEX "TenantPlacement_rentalListingId_idx" ON "TenantPlacement"("rentalListingId");

-- CreateIndex
CREATE INDEX "TenantPlacement_status_idx" ON "TenantPlacement"("status");

-- CreateIndex
CREATE INDEX "TenantPlacement_completedAt_idx" ON "TenantPlacement"("completedAt");

-- CreateIndex
CREATE INDEX "Prospect_rentalListingId_idx" ON "Prospect"("rentalListingId");

-- CreateIndex
CREATE INDEX "Application_rentalListingId_idx" ON "Application"("rentalListingId");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_rentalListingId_fkey" FOREIGN KEY ("rentalListingId") REFERENCES "RentalListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_rentalListingId_fkey" FOREIGN KEY ("rentalListingId") REFERENCES "RentalListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPlacement" ADD CONSTRAINT "TenantPlacement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPlacement" ADD CONSTRAINT "TenantPlacement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPlacement" ADD CONSTRAINT "TenantPlacement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPlacement" ADD CONSTRAINT "TenantPlacement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPlacement" ADD CONSTRAINT "TenantPlacement_rentalListingId_fkey" FOREIGN KEY ("rentalListingId") REFERENCES "RentalListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPlacement" ADD CONSTRAINT "TenantPlacement_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
