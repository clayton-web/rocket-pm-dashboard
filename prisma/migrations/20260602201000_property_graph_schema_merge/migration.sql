-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streetLine1" TEXT NOT NULL,
    "streetLine2" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL DEFAULT 'BC',
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "floor" TEXT,
    "bedrooms" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPropertyAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPropertyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "Property_organizationId_idx" ON "Property"("organizationId");

-- CreateIndex
CREATE INDEX "Unit_propertyId_idx" ON "Unit"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_propertyId_unitNumber_key" ON "Unit"("propertyId", "unitNumber");

-- CreateIndex
CREATE INDEX "UserPropertyAssignment_userId_idx" ON "UserPropertyAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserPropertyAssignment_propertyId_idx" ON "UserPropertyAssignment"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPropertyAssignment_userId_propertyId_roleId_key" ON "UserPropertyAssignment"("userId", "propertyId", "roleId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPropertyAssignment" ADD CONSTRAINT "UserPropertyAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPropertyAssignment" ADD CONSTRAINT "UserPropertyAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPropertyAssignment" ADD CONSTRAINT "UserPropertyAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
