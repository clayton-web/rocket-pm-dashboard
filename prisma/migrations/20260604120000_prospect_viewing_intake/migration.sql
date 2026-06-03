-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "occupantCount" INTEGER;
ALTER TABLE "Prospect" ADD COLUMN "hasPets" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Prospect" ADD COLUMN "petDetails" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "smokerStatus" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "householdIncomeRange" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "desiredMoveInDate" DATE;
ALTER TABLE "Prospect" ADD COLUMN "preferredViewingNotes" TEXT;
