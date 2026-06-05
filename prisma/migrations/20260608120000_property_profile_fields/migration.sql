-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "propertyType" TEXT,
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "bathrooms" DECIMAL(4,1),
ADD COLUMN     "approxSqft" INTEGER;
