-- Prospect pipeline milestones (PM-initiated, no unified status enum).
ALTER TABLE "Prospect" ADD COLUMN "qualifiedAt" TIMESTAMP(3);
ALTER TABLE "Prospect" ADD COLUMN "applicationSentAt" TIMESTAMP(3);
