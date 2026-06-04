-- CreateEnum
CREATE TYPE "LeaseSignatureRole" AS ENUM ('tenant', 'property_manager');

-- AlterTable
ALTER TABLE "SignatureRequest" ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "executedDocumentId" TEXT,
ADD COLUMN     "signingTokenHash" TEXT,
ADD COLUMN     "signingTokenExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LeaseSignature" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "signerRole" "LeaseSignatureRole" NOT NULL,
    "signerName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signatureImageStorageKey" TEXT NOT NULL,
    "tenancyContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaseSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_signingTokenHash_key" ON "SignatureRequest"("signingTokenHash");

-- CreateIndex
CREATE INDEX "SignatureRequest_documentId_idx" ON "SignatureRequest"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseSignature_signatureRequestId_signerRole_key" ON "LeaseSignature"("signatureRequestId", "signerRole");

-- CreateIndex
CREATE INDEX "LeaseSignature_signatureRequestId_idx" ON "LeaseSignature"("signatureRequestId");

-- CreateIndex
CREATE INDEX "LeaseSignature_tenancyContactId_idx" ON "LeaseSignature"("tenancyContactId");

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_executedDocumentId_fkey" FOREIGN KEY ("executedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSignature" ADD CONSTRAINT "LeaseSignature_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSignature" ADD CONSTRAINT "LeaseSignature_tenancyContactId_fkey" FOREIGN KEY ("tenancyContactId") REFERENCES "TenancyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
