-- CreateEnum
CREATE TYPE "PropertyServiceRelationship" AS ENUM ('MANAGED', 'PRE_MANAGEMENT', 'PLACEMENT_ONLY');

-- AlterTable
-- Existing portfolio rows default to MANAGED (they are already in the management portfolio).
ALTER TABLE "Property" ADD COLUMN "serviceRelationship" "PropertyServiceRelationship" NOT NULL DEFAULT 'MANAGED';

-- CreateIndex
CREATE INDEX "Property_serviceRelationship_idx" ON "Property"("serviceRelationship");
