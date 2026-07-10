import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient, Property, Unit } from "@prisma/client";
import { ENTIRE_PROPERTY_UNIT_NUMBER } from "@/lib/property/entire-property-unit";
import type { StaffContext } from "./staff-context";
import { createProperty } from "./property.service";

const ORG_ID = "org_test";

function adminContext(): StaffContext {
  return {
    userId: "user_admin",
    organizationId: ORG_ID,
    organizationRole: "ADMIN",
    primaryRoleKey: "administrator",
    assignmentRolesByProperty: new Map(),
  };
}

function createMockPrisma() {
  const unitCreates: Array<{ data: { propertyId: string; unitNumber: string } }> = [];

  const prisma = {
    $transaction: async <T>(fn: (tx: PrismaClient) => Promise<T>) => fn(prisma as unknown as PrismaClient),
    property: {
      create: async ({
        data,
      }: {
        data: {
          organizationId: string;
          name: string;
          streetLine1: string;
          streetLine2: string | null;
          city: string;
          province: string;
          postalCode: string;
        country: string;
        propertyType?: string | null;
        bedrooms?: number | null;
        bathrooms?: unknown;
        approxSqft?: number | null;
      };
      }): Promise<Property> => ({
        id: "prop_test",
        isActive: true,
        serviceRelationship: (data as { serviceRelationship?: Property["serviceRelationship"] })
          .serviceRelationship ?? "MANAGED",
        propertyType: data.propertyType ?? null,
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        approxSqft: data.approxSqft ?? null,
        ownerEmail: null,
        ownerPhone: null,
        strataNotes: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        ...data,
      }),
      findFirst: async () => ({ organizationId: ORG_ID }),
      count: async () => 1,
    },
    unit: {
      create: async ({
        data,
      }: {
        data: {
          propertyId: string;
          unitNumber: string;
          floor?: string | null;
          bedrooms?: number | null;
        };
      }): Promise<Unit> => {
        unitCreates.push({ data });
        return {
          id: "unit_test",
          propertyId: data.propertyId,
          unitNumber: data.unitNumber,
          floor: data.floor ?? null,
          bedrooms: data.bedrooms ?? null,
          isActive: true,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        };
      },
    },
    activityLog: {
      create: async () => ({}),
    },
    get unitCreates() {
      return unitCreates;
    },
  };

  return prisma;
}

describe("createProperty", () => {
  it("creates an active Entire Property unit in the same transaction", async () => {
    const prisma = createMockPrisma();

    const property = await createProperty(prisma as unknown as PrismaClient, adminContext(), {
      organizationId: ORG_ID,
      name: "123 Main Street",
      streetLine1: "123 Main Street",
      streetLine2: null,
      city: "Vancouver",
      province: "BC",
      postalCode: "V6B 1A1",
      serviceRelationship: "MANAGED",
      propertyType: "condo",
      bedrooms: 2,
      bathrooms: 1.5,
      approxSqft: 850,
    });

    assert.equal(property.streetLine1, "123 Main Street");
    assert.equal(property.serviceRelationship, "MANAGED");
    assert.equal(property.propertyType, "condo");
    assert.equal(property.bedrooms, 2);
    assert.equal(property.approxSqft, 850);
    assert.equal(prisma.unitCreates.length, 1);
    assert.equal(prisma.unitCreates[0]?.data.propertyId, "prop_test");
    assert.equal(prisma.unitCreates[0]?.data.unitNumber, ENTIRE_PROPERTY_UNIT_NUMBER);
  });

  it("persists placement-only and pre-management relationships", async () => {
    for (const serviceRelationship of ["PLACEMENT_ONLY", "PRE_MANAGEMENT"] as const) {
      const prisma = createMockPrisma();
      const property = await createProperty(prisma as unknown as PrismaClient, adminContext(), {
        organizationId: ORG_ID,
        name: "456 Oak",
        streetLine1: "456 Oak",
        city: "Vancouver",
        province: "BC",
        postalCode: "V6B 1A1",
        serviceRelationship,
      });
      assert.equal(property.serviceRelationship, serviceRelationship);
    }
  });
});
