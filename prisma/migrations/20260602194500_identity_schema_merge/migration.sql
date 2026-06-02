-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('administrator', 'property_manager', 'field_agent', 'tenant');

-- CreateEnum
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('ADMIN', 'MEMBER', 'OWNER');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "primaryRoleId" TEXT;

-- CreateIndex
CREATE INDEX "User_primaryRoleId_idx" ON "User"("primaryRoleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryRoleId_fkey" FOREIGN KEY ("primaryRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate OrganizationMembership.role without data loss
ALTER TABLE "OrganizationMembership" ADD COLUMN "role_new" "OrganizationMembershipRole";

UPDATE "OrganizationMembership"
SET "role_new" = CASE
    WHEN "role"::text = 'ORG_ADMIN' THEN 'ADMIN'::"OrganizationMembershipRole"
    WHEN "role"::text = 'PROPERTY_MANAGER' THEN 'MEMBER'::"OrganizationMembershipRole"
    ELSE 'MEMBER'::"OrganizationMembershipRole"
END;

ALTER TABLE "OrganizationMembership" ALTER COLUMN "role_new" SET NOT NULL;
ALTER TABLE "OrganizationMembership" ALTER COLUMN "role_new" SET DEFAULT 'MEMBER';

ALTER TABLE "OrganizationMembership" DROP COLUMN "role";

ALTER TABLE "OrganizationMembership" RENAME COLUMN "role_new" TO "role";

-- DropEnum
DROP TYPE "OrganizationRole";
