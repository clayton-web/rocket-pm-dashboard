import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { PlacementOnlyConversionBlockedError } from "@/lib/leasing/application-conversion-policy";
import { ForbiddenError, NotFoundError } from "./errors";
import type { StaffContext } from "./staff-context";
import { createTenancyFromApprovedApplication } from "./tenancy.service";

const ORG_ID = "org_test";
const OTHER_ORG_ID = "org_other";
const PROPERTY_ID = "prop_test";
const UNIT_ID = "unit_test";
const APP_ID = "app_test";

function adminContext(): StaffContext {
  return {
    userId: "user_admin",
    organizationId: ORG_ID,
    organizationRole: "ADMIN",
    primaryRoleKey: "administrator",
    assignmentRolesByProperty: new Map(),
  };
}

function fieldAgentContext(): StaffContext {
  return {
    userId: "user_fa",
    organizationId: ORG_ID,
    organizationRole: "MEMBER",
    primaryRoleKey: "field_agent",
    assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["field_agent"])]]),
  };
}

function createMockPrisma(args: {
  serviceRelationship: "MANAGED" | "PRE_MANAGEMENT" | "PLACEMENT_ONLY";
  applicationStatus?: string;
  existingTenancy?: boolean;
  propertyOrgId?: string;
  failTenancyCreate?: boolean;
}) {
  let propertyRelationship = args.serviceRelationship;
  const created: { tenancy: boolean; propertyUpdates: string[] } = {
    tenancy: false,
    propertyUpdates: [],
  };

  const prisma = {
    application: {
      findUnique: async () => ({
        id: APP_ID,
        status: args.applicationStatus ?? "approved",
        propertyId: PROPERTY_ID,
        unitId: UNIT_ID,
        property: {
          id: PROPERTY_ID,
          organizationId: args.propertyOrgId ?? ORG_ID,
          serviceRelationship: propertyRelationship,
        },
      }),
    },
    tenancy: {
      findUnique: async () => (args.existingTenancy ? { id: "ten_existing" } : null),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (args.failTenancyCreate) {
          throw new Error("simulated tenancy create failure");
        }
        created.tenancy = true;
        return {
          id: "ten_new",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    },
    property: {
      findFirst: async () => ({
        id: PROPERTY_ID,
        organizationId: args.propertyOrgId ?? ORG_ID,
      }),
      findUnique: async () => ({
        serviceRelationship: propertyRelationship,
      }),
      update: async ({ data }: { data: { serviceRelationship: string } }) => {
        propertyRelationship = data.serviceRelationship as typeof propertyRelationship;
        created.propertyUpdates.push(data.serviceRelationship);
        return { id: PROPERTY_ID, serviceRelationship: propertyRelationship };
      },
    },
    activityLog: {
      create: async () => ({}),
    },
    get created() {
      return created;
    },
    get propertyRelationship() {
      return propertyRelationship;
    },
  };

  return prisma;
}

const leaseInput = {
  applicationId: APP_ID,
  leaseStartDate: new Date("2026-08-01T12:00:00.000Z"),
  moveInDate: new Date("2026-08-01T12:00:00.000Z"),
  monthlyRent: 2200,
  securityDeposit: 1100,
};

describe("createTenancyFromApprovedApplication service relationship", () => {
  it("creates tenancy for MANAGED and leaves relationship unchanged", async () => {
    const prisma = createMockPrisma({ serviceRelationship: "MANAGED" });
    await createTenancyFromApprovedApplication(
      prisma as unknown as PrismaClient,
      adminContext(),
      leaseInput,
    );
    assert.equal(prisma.created.tenancy, true);
    assert.deepEqual(prisma.created.propertyUpdates, []);
    assert.equal(prisma.propertyRelationship, "MANAGED");
  });

  it("creates tenancy for PRE_MANAGEMENT and transitions to MANAGED", async () => {
    const prisma = createMockPrisma({ serviceRelationship: "PRE_MANAGEMENT" });
    await createTenancyFromApprovedApplication(
      prisma as unknown as PrismaClient,
      adminContext(),
      leaseInput,
    );
    assert.equal(prisma.created.tenancy, true);
    assert.deepEqual(prisma.created.propertyUpdates, ["MANAGED"]);
    assert.equal(prisma.propertyRelationship, "MANAGED");
  });

  it("leaves PRE_MANAGEMENT when tenancy create fails (no transition)", async () => {
    const prisma = createMockPrisma({
      serviceRelationship: "PRE_MANAGEMENT",
      failTenancyCreate: true,
    });
    await assert.rejects(() =>
      createTenancyFromApprovedApplication(
        prisma as unknown as PrismaClient,
        adminContext(),
        leaseInput,
      ),
    );
    assert.equal(prisma.created.tenancy, false);
    assert.deepEqual(prisma.created.propertyUpdates, []);
    assert.equal(prisma.propertyRelationship, "PRE_MANAGEMENT");
  });

  it("blocks PLACEMENT_ONLY and creates nothing", async () => {
    const prisma = createMockPrisma({ serviceRelationship: "PLACEMENT_ONLY" });
    await assert.rejects(
      () =>
        createTenancyFromApprovedApplication(
          prisma as unknown as PrismaClient,
          adminContext(),
          leaseInput,
        ),
      (err: unknown) => err instanceof PlacementOnlyConversionBlockedError,
    );
    assert.equal(prisma.created.tenancy, false);
    assert.deepEqual(prisma.created.propertyUpdates, []);
    assert.equal(prisma.propertyRelationship, "PLACEMENT_ONLY");
  });

  it("does not transition when application is not approved", async () => {
    const prisma = createMockPrisma({
      serviceRelationship: "PRE_MANAGEMENT",
      applicationStatus: "submitted",
    });
    await assert.rejects(() =>
      createTenancyFromApprovedApplication(
        prisma as unknown as PrismaClient,
        adminContext(),
        leaseInput,
      ),
    );
    assert.equal(prisma.created.tenancy, false);
    assert.deepEqual(prisma.created.propertyUpdates, []);
    assert.equal(prisma.propertyRelationship, "PRE_MANAGEMENT");
  });

  it("blocks duplicate conversion", async () => {
    const prisma = createMockPrisma({
      serviceRelationship: "MANAGED",
      existingTenancy: true,
    });
    await assert.rejects(() =>
      createTenancyFromApprovedApplication(
        prisma as unknown as PrismaClient,
        adminContext(),
        leaseInput,
      ),
    );
    assert.equal(prisma.created.tenancy, false);
  });

  it("blocks field agents", async () => {
    const prisma = createMockPrisma({ serviceRelationship: "MANAGED" });
    await assert.rejects(
      () =>
        createTenancyFromApprovedApplication(
          prisma as unknown as PrismaClient,
          fieldAgentContext(),
          leaseInput,
        ),
      (err: unknown) => err instanceof ForbiddenError,
    );
    assert.equal(prisma.created.tenancy, false);
  });

  it("rejects cross-organization application ids", async () => {
    const prisma = createMockPrisma({
      serviceRelationship: "MANAGED",
      propertyOrgId: OTHER_ORG_ID,
    });
    await assert.rejects(
      () =>
        createTenancyFromApprovedApplication(
          prisma as unknown as PrismaClient,
          adminContext(),
          leaseInput,
        ),
      (err: unknown) => err instanceof NotFoundError,
    );
    assert.equal(prisma.created.tenancy, false);
  });

  it("uses property.serviceRelationship from the loaded application, not client input", async () => {
    const prisma = createMockPrisma({ serviceRelationship: "PLACEMENT_ONLY" });
    // Caller cannot pass serviceRelationship on leaseInput — only DB value is used.
    await assert.rejects(
      () =>
        createTenancyFromApprovedApplication(
          prisma as unknown as PrismaClient,
          adminContext(),
          leaseInput,
        ),
      PlacementOnlyConversionBlockedError,
    );
  });
});
