-- AlterEnum
ALTER TYPE "TenancyStatus" ADD VALUE 'inspection_scheduled';
ALTER TYPE "TenancyStatus" ADD VALUE 'inspection_completed';

-- AlterTable
ALTER TABLE "Tenancy" ADD COLUMN "inspectionDate" DATE;
ALTER TABLE "Tenancy" ADD COLUMN "inspectionReportUrl" TEXT;
ALTER TABLE "Tenancy" ADD COLUMN "inspectionNotes" TEXT;
