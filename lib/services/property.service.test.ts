import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient, type Property, type Unit } from "@prisma/client";
import { ENTIRE_PROPERTY_UNIT_NUMBER } from "@/lib/property/entire-property-unit";
import type { StaffContext } from "./staff-context";
import { createProperty, propertyAuditSnapshot, updateProperty } from "./property.service";

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

type AuditLogRow = {
  action: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
};

function createMockPrisma() {
  const unitCreates: Array<{ data: { propertyId: string; unitNumber: string } }> = [];
  const activityLogs: AuditLogRow[] = [];

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
        bathrooms?: Prisma.Decimal | null;
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
      create: async ({ data }: { data: Record<string, unknown> }) => {
        activityLogs.push(data as AuditLogRow);
        return {};
      },
    },
    get unitCreates() {
      return unitCreates;
    },
    get activityLogs() {
      return activityLogs;
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

  it("captures address and bathrooms in the created-property audit snapshot", async () => {
    const prisma = createMockPrisma();

    await createProperty(prisma as unknown as PrismaClient, adminContext(), {
      organizationId: ORG_ID,
      name: "123 Main Street",
      streetLine1: "123 Main Street",
      streetLine2: "Upper",
      city: "Vancouver",
      province: "BC",
      postalCode: "V6B 1A1",
      serviceRelationship: "MANAGED",
      bathrooms: 1.5,
    });

    const created = prisma.activityLogs.find((log) => log.action === "property.created");
    assert.ok(created, "expected a property.created activity log");
    assert.equal(created.newValues?.streetLine1, "123 Main Street");
    assert.equal(created.newValues?.streetLine2, "Upper");
    assert.equal(created.newValues?.bathrooms, 1.5);
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

function existingProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop_test",
    organizationId: ORG_ID,
    name: "123 Main Street",
    streetLine1: "123 Main Street",
    streetLine2: null,
    city: "Vancouver",
    province: "BC",
    postalCode: "V6B 1A1",
    country: "CA",
    isActive: true,
    serviceRelationship: "MANAGED",
    propertyType: null,
    bedrooms: null,
    bathrooms: null,
    approxSqft: null,
    ownerEmail: null,
    ownerPhone: null,
    strataNotes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Property;
}

function createUpdateMockPrisma(before: Property) {
  const logs: Array<{
    action: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }> = [];
  let current = before;

  const prisma = {
    property: {
      findFirst: async () => ({ organizationId: ORG_ID }),
      count: async () => 1,
      findUnique: async () => current,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        current = { ...current, ...data } as Property;
        return current;
      },
    },
    activityLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        logs.push(data as (typeof logs)[number]);
        return {};
      },
    },
    get logs() {
      return logs;
    },
  };

  return prisma;
}

describe("updateProperty audit coverage", () => {
  it("records old and new street lines when an address changes", async () => {
    const prisma = createUpdateMockPrisma(existingProperty());

    await updateProperty(prisma as unknown as PrismaClient, adminContext(), "prop_test", {
      streetLine1: "125 Main Street",
      streetLine2: "Coach House",
    });

    const updated = prisma.logs.find((log) => log.action === "property.updated");
    assert.ok(updated, "expected a property.updated activity log");
    assert.equal(updated.oldValues?.streetLine1, "123 Main Street");
    assert.equal(updated.oldValues?.streetLine2, null);
    assert.equal(updated.newValues?.streetLine1, "125 Main Street");
    assert.equal(updated.newValues?.streetLine2, "Coach House");
  });

  it("records city, province, postal code, and country changes", async () => {
    const prisma = createUpdateMockPrisma(existingProperty());

    await updateProperty(prisma as unknown as PrismaClient, adminContext(), "prop_test", {
      city: "Burnaby",
      postalCode: "V5H 2K3",
    });

    const updated = prisma.logs.find((log) => log.action === "property.updated");
    assert.equal(updated?.oldValues?.city, "Vancouver");
    assert.equal(updated?.newValues?.city, "Burnaby");
    assert.equal(updated?.oldValues?.postalCode, "V6B 1A1");
    assert.equal(updated?.newValues?.postalCode, "V5H 2K3");
    assert.equal(updated?.newValues?.province, "BC");
    assert.equal(updated?.newValues?.country, "CA");
  });

  it("flattens the bathrooms Decimal to a number in the snapshot", async () => {
    const prisma = createUpdateMockPrisma(
      existingProperty({ bathrooms: new Prisma.Decimal("1.5") }),
    );

    await updateProperty(prisma as unknown as PrismaClient, adminContext(), "prop_test", {
      bathrooms: 2.5,
    });

    const updated = prisma.logs.find((log) => log.action === "property.updated");
    assert.equal(updated?.oldValues?.bathrooms, 1.5);
    assert.equal(updated?.newValues?.bathrooms, 2.5);
  });

  it("denies a field agent and writes no audit entry", async () => {
    const prisma = createUpdateMockPrisma(existingProperty());
    const fieldAgent: StaffContext = {
      userId: "user_agent",
      organizationId: ORG_ID,
      organizationRole: "MEMBER",
      primaryRoleKey: "field_agent",
      assignmentRolesByProperty: new Map([["prop_test", new Set(["field_agent"])]]),
    };

    await assert.rejects(
      () =>
        updateProperty(prisma as unknown as PrismaClient, fieldAgent, "prop_test", {
          streetLine1: "999 Nope St",
        }),
      /Property manager access required/,
    );
    assert.equal(prisma.logs.length, 0);
  });
});

describe("propertyAuditSnapshot", () => {
  it("covers every field the address-edit workflow will change", () => {
    const snapshot = propertyAuditSnapshot(existingProperty());
    for (const field of [
      "name",
      "streetLine1",
      "streetLine2",
      "city",
      "province",
      "postalCode",
      "country",
      "bathrooms",
    ]) {
      assert.ok(field in snapshot, `${field} missing from the property audit snapshot`);
    }
  });

  it("keeps a null bathrooms value null rather than coercing it to zero", () => {
    assert.equal(propertyAuditSnapshot(existingProperty({ bathrooms: null })).bathrooms, null);
  });
});
