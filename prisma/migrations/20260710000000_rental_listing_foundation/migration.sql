-- CreateEnum
CREATE TYPE "RentalListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED');

-- CreateTable
CREATE TABLE "RentalListing" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "RentalListingStatus" NOT NULL DEFAULT 'DRAFT',
    "monthlyRent" DECIMAL(12,2),
    "availableDate" DATE,
    "bedrooms" INTEGER,
    "bathrooms" DECIMAL(4,1),
    "approxSqft" INTEGER,
    "headline" TEXT,
    "description" TEXT,
    "petPolicy" TEXT,
    "parkingDetails" TEXT,
    "utilitiesDetails" TEXT,
    "viewingInstructions" TEXT,
    "publishedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalListing_organizationId_idx" ON "RentalListing"("organizationId");

-- CreateIndex
CREATE INDEX "RentalListing_propertyId_idx" ON "RentalListing"("propertyId");

-- CreateIndex
CREATE INDEX "RentalListing_unitId_idx" ON "RentalListing"("unitId");

-- CreateIndex
CREATE INDEX "RentalListing_status_idx" ON "RentalListing"("status");

-- CreateIndex
CREATE INDEX "RentalListing_organizationId_status_idx" ON "RentalListing"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RentalListing_unitId_status_idx" ON "RentalListing"("unitId", "status");

-- CreateIndex
CREATE INDEX "RentalListing_organizationId_status_publishedAt_idx" ON "RentalListing"("organizationId", "status", "publishedAt");

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
