-- CreateEnum
CREATE TYPE "BuildiumConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'NEEDS_REAUTH', 'ERROR');

-- CreateEnum
CREATE TYPE "BuildiumEnvironment" AS ENUM ('PRODUCTION', 'SANDBOX');

-- CreateEnum
CREATE TYPE "BuildiumSyncStatus" AS ENUM ('NEVER_SYNCED', 'SYNCED', 'PARTIAL', 'ERROR', 'STALE');

-- CreateTable
CREATE TABLE "BuildiumConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "BuildiumConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "environment" "BuildiumEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "lastTestedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" "BuildiumSyncStatus",
    "lastSyncError" TEXT,
    "syncPropertyIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildiumConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuildiumConnection_organizationId_key" ON "BuildiumConnection"("organizationId");

-- CreateIndex
CREATE INDEX "BuildiumConnection_organizationId_idx" ON "BuildiumConnection"("organizationId");

-- AddForeignKey
ALTER TABLE "BuildiumConnection" ADD CONSTRAINT "BuildiumConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
