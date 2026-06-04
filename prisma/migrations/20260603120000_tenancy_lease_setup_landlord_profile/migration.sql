-- Organization landlord / service profile for RTB-1
ALTER TABLE "Organization" ADD COLUMN "landlordLegalName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "landlordServiceStreetLine1" TEXT;
ALTER TABLE "Organization" ADD COLUMN "landlordServiceStreetLine2" TEXT;
ALTER TABLE "Organization" ADD COLUMN "landlordServiceCity" TEXT;
ALTER TABLE "Organization" ADD COLUMN "landlordServiceProvince" TEXT DEFAULT 'BC';
ALTER TABLE "Organization" ADD COLUMN "landlordServicePostalCode" TEXT;
ALTER TABLE "Organization" ADD COLUMN "landlordServicePhone" TEXT;
ALTER TABLE "Organization" ADD COLUMN "landlordServiceEmail" TEXT;
ALTER TABLE "Organization" ADD COLUMN "landlordIsAgent" BOOLEAN NOT NULL DEFAULT false;

-- Application emergency contact (ported to tenancy on conversion)
ALTER TABLE "Application" ADD COLUMN "emergencyContactFirstName" TEXT;
ALTER TABLE "Application" ADD COLUMN "emergencyContactLastName" TEXT;
ALTER TABLE "Application" ADD COLUMN "emergencyContactPhone" TEXT;
ALTER TABLE "Application" ADD COLUMN "emergencyContactEmail" TEXT;

-- Tenancy RTB-1 lease setup payload
ALTER TABLE "Tenancy" ADD COLUMN "leaseSetupJson" JSONB;
