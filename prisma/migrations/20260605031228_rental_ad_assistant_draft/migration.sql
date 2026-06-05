-- CreateTable
CREATE TABLE "RentalAdAssistantDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "inputsJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "compsSnapshotJson" JSONB,
    "model" TEXT,
    "promptVersion" TEXT,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalAdAssistantDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentalAdAssistantDraft_unitId_key" ON "RentalAdAssistantDraft"("unitId");

-- CreateIndex
CREATE INDEX "RentalAdAssistantDraft_organizationId_propertyId_idx" ON "RentalAdAssistantDraft"("organizationId", "propertyId");

-- CreateIndex
CREATE INDEX "RentalAdAssistantDraft_organizationId_updatedAt_idx" ON "RentalAdAssistantDraft"("organizationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "RentalAdAssistantDraft" ADD CONSTRAINT "RentalAdAssistantDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAdAssistantDraft" ADD CONSTRAINT "RentalAdAssistantDraft_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAdAssistantDraft" ADD CONSTRAINT "RentalAdAssistantDraft_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
