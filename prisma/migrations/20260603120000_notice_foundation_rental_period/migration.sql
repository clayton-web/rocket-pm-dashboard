-- PR 10A: Notice foundation & rental period anchor

ALTER TABLE "Tenancy" ADD COLUMN "rentDueDay" INTEGER NOT NULL DEFAULT 1;

UPDATE "Tenancy"
SET "rentDueDay" = EXTRACT(DAY FROM "leaseStartDate")::INTEGER;

ALTER TABLE "Notice" ADD COLUMN "tenantRequestedMoveOutDate" DATE;
