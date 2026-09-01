-- CreateEnum
CREATE TYPE "IntegrationApp" AS ENUM ('ROCKET_COMMUNICATOR');

-- CreateEnum
CREATE TYPE "IntegrationCredentialEnvironment" AS ENUM ('PRODUCTION', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "IntegrationCredentialScope" AS ENUM ('PM_CONTEXT_READ');

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "app" "IntegrationApp" NOT NULL,
    "environment" "IntegrationCredentialEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "name" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" "IntegrationCredentialScope"[] DEFAULT ARRAY[]::"IntegrationCredentialScope"[],
    "createdByUserId" TEXT,
    "revokedByUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_keyId_key" ON "IntegrationCredential"("keyId");

-- CreateIndex
CREATE INDEX "IntegrationCredential_organizationId_idx" ON "IntegrationCredential"("organizationId");

-- CreateIndex
CREATE INDEX "IntegrationCredential_organizationId_app_environment_idx" ON "IntegrationCredential"("organizationId", "app", "environment");

-- CreateIndex
CREATE INDEX "IntegrationCredential_revokedAt_idx" ON "IntegrationCredential"("revokedAt");

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
-- Machine principals (integration credentials) have no staff user; existing rows all have an actor.
ALTER TABLE "AuditLog" ALTER COLUMN "actorUserId" DROP NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN "integrationCredentialId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_integrationCredentialId_createdAt_idx" ON "AuditLog"("integrationCredentialId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_integrationCredentialId_fkey" FOREIGN KEY ("integrationCredentialId") REFERENCES "IntegrationCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
