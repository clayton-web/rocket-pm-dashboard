-- CreateTable
CREATE TABLE "EmailSenderCategoryMemory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "senderEmail" TEXT NOT NULL,
  "senderName" TEXT,
  "category" "EmailThreadCategory" NOT NULL,
  "contextNote" TEXT,
  "source" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "lastMatchedAt" TIMESTAMP(3),
  "matchCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailSenderCategoryMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSenderCategoryMemory_organizationId_connectedAccountId_senderEmail_key"
  ON "EmailSenderCategoryMemory"("organizationId", "connectedAccountId", "senderEmail");

-- CreateIndex
CREATE INDEX "EmailSenderCategoryMemory_organizationId_connectedAccountId_idx"
  ON "EmailSenderCategoryMemory"("organizationId", "connectedAccountId");

-- AddForeignKey
ALTER TABLE "EmailSenderCategoryMemory"
  ADD CONSTRAINT "EmailSenderCategoryMemory_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSenderCategoryMemory"
  ADD CONSTRAINT "EmailSenderCategoryMemory_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedEmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSenderCategoryMemory"
  ADD CONSTRAINT "EmailSenderCategoryMemory_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
