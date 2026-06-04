-- CreateTable
CREATE TABLE "TenantOtpChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantOtpChallenge_email_key" ON "TenantOtpChallenge"("email");

-- CreateIndex
CREATE INDEX "TenantOtpChallenge_expiresAt_idx" ON "TenantOtpChallenge"("expiresAt");
