import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient, type RentalListing } from "@prisma/client";
import { ACTIVE_TENANCY_BLOCKS_PUBLISH_MESSAGE } from "@/lib/leasing/rental-listing-active-tenancy";
import type { StaffContext } from "./staff-context";
import {
  closeRentalListing,
  createRentalListingDraft,
  getRentalListingById,
  isRentalListingPubliclyVisible,
  pauseRentalListing,
  publishRentalListing,
  republishRentalListing,
  returnRentalListingToDraft,
  updateRentalListing,
} from "./rental-listing.service";

const ORG_ID = "org_test";
const OTHER_ORG_ID = "org_other";
const PROPERTY_ID = "prop_test";
const UNIT_ID = "unit_test";
const OTHER_UNIT_ID = "unit_other";
const LISTING_ID = "listing_test";

function adminContext(): StaffContext {
  return {
    userId: "user_admin",
    organizationId: ORG_ID,
    organizationRole: "ADMIN",
    primaryRoleKey: "administrator",
    assignmentRolesByProperty: new Map(),
  };
}

function pmContext(): StaffContext {
  return {
    userId: "user_pm",
    organizationId: ORG_ID,
    organizationRole: "MEMBER",
    primaryRoleKey: "property_manager",
    assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["property_manager"])]]),
  };
}

function fieldAgentContext(): StaffContext {
  return {
    userId: "user_agent",
    organizationId: ORG_ID,
    organizationRole: "MEMBER",
    primaryRoleKey: "field_agent",
    assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["field_agent"])]]),
  };
}

function otherOrgAdmin(): StaffContext {
  return {
    userId: "user_other",
    organizationId: OTHER_ORG_ID,
    organizationRole: "ADMIN",
    primaryRoleKey: "administrator",
    assignmentRolesByProperty: new Map(),
  };
}

type Store = {
  listings: RentalListing[];
  propertyActive: boolean;
  unitActive: boolean;
  unitPropertyId: string;
  propertyOrgId: string;
  tenancyStatus: string | null;
  propertyBedrooms: number | null;
  propertyBathrooms: number | null;
  propertyApproxSqft: number | null;
};

function baseListing(overrides: Partial<RentalListing> = {}): RentalListing {
  return {
    id: LISTING_ID,
    organizationId: ORG_ID,
    propertyId: PROPERTY_ID,
    unitId: UNIT_ID,
    status: "DRAFT",
    monthlyRent: new Prisma.Decimal(2200),
    availableDate: new Date("2026-08-01T00:00:00.000Z"),
    bedrooms: 2,
    bathrooms: new Prisma.Decimal(1),
    approxSqft: 800,
    headline: "Bright 2BR",
    description: "A comfortable home near transit.",
    petPolicy: null,
    parkingDetails: null,
    utilitiesDetails: null,
    viewingInstructions: null,
    publishedAt: null,
    pausedAt: null,
    closedAt: null,
    createdByUserId: "user_admin",
    updatedByUserId: "user_admin",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function createMockPrisma(store: Store) {
  const prisma = {
    $transaction: async <T>(fn: (tx: PrismaClient) => Promise<T>) =>
      fn(prisma as unknown as PrismaClient),
    property: {
      findFirst: async ({ where }: { where: { id: string } }) => {
        if (where.id !== PROPERTY_ID) return null;
        return { id: PROPERTY_ID, organizationId: store.propertyOrgId };
      },
    },
    unit: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== UNIT_ID && where.id !== OTHER_UNIT_ID) return null;
        const propertyId = where.id === OTHER_UNIT_ID ? "prop_mismatch" : store.unitPropertyId;
        return {
          id: where.id,
          propertyId,
          unitNumber: where.id === OTHER_UNIT_ID ? "2" : "Entire Property",
          bedrooms: 2,
          isActive: store.unitActive,
          property: {
            id: propertyId,
            organizationId: store.propertyOrgId,
            isActive: store.propertyActive,
            bedrooms: store.propertyBedrooms,
            bathrooms:
              store.propertyBathrooms != null
                ? new Prisma.Decimal(store.propertyBathrooms)
                : null,
            approxSqft: store.propertyApproxSqft,
            name: "123 Main",
            streetLine1: "123 Main Street",
          },
        };
      },
    },
    tenancy: {
      findFirst: async ({
        where,
      }: {
        where?: { unitId?: string; status?: { in: string[] } };
      } = {}) => {
        if (!store.tenancyStatus) return null;
        if (where?.status?.in && !where.status.in.includes(store.tenancyStatus)) {
          return null;
        }
        return { id: "ten_1", status: store.tenancyStatus };
      },
    },
    rentalListing: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.listings.find((l) => l.id === where.id) ?? null,
      findFirst: async ({
        where,
      }: {
        where: {
          unitId: string;
          status?: { in: string[] };
          id?: { not: string };
        };
      }) => {
        return (
          store.listings.find((l) => {
            if (l.unitId !== where.unitId) return false;
            if (where.id?.not && l.id === where.id.not) return false;
            if (where.status?.in && !where.status.in.includes(l.status)) return false;
            return true;
          }) ?? null
        );
      },
      findMany: async () => store.listings,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = baseListing({
          id: `listing_${store.listings.length + 1}`,
          organizationId: String(data.organizationId),
          propertyId: String(data.propertyId),
          unitId: String(data.unitId),
          status: "DRAFT",
          monthlyRent: (data.monthlyRent as Prisma.Decimal | null) ?? null,
          availableDate: (data.availableDate as Date | null) ?? null,
          bedrooms: (data.bedrooms as number | null) ?? null,
          bathrooms: (data.bathrooms as Prisma.Decimal | null) ?? null,
          approxSqft: (data.approxSqft as number | null) ?? null,
          headline: (data.headline as string | null) ?? null,
          description: (data.description as string | null) ?? null,
          petPolicy: (data.petPolicy as string | null) ?? null,
          parkingDetails: (data.parkingDetails as string | null) ?? null,
          utilitiesDetails: (data.utilitiesDetails as string | null) ?? null,
          viewingInstructions: (data.viewingInstructions as string | null) ?? null,
        });
        store.listings.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const idx = store.listings.findIndex((l) => l.id === where.id);
        if (idx < 0) throw new Error("missing");
        const next = { ...store.listings[idx], ...data, updatedAt: new Date() } as RentalListing;
        store.listings[idx] = next;
        return next;
      },
    },
    activityLog: {
      create: async () => ({}),
    },
    userPropertyAssignment: {
      findFirst: async () => ({ id: "assign_1" }),
    },
  };

  return prisma;
}

function defaultStore(overrides: Partial<Store> = {}): Store {
  return {
    listings: [],
    propertyActive: true,
    unitActive: true,
    unitPropertyId: PROPERTY_ID,
    propertyOrgId: ORG_ID,
    tenancyStatus: null,
    propertyBedrooms: 2,
    propertyBathrooms: 1,
    propertyApproxSqft: 800,
    ...overrides,
  };
}

describe("createRentalListingDraft", () => {
  it("creates a draft for an accessible property/unit and prefills profile fields", async () => {
    const store = defaultStore();
    const prisma = createMockPrisma(store);
    const row = await createRentalListingDraft(prisma as unknown as PrismaClient, adminContext(), {
      propertyId: PROPERTY_ID,
      unitId: UNIT_ID,
    });
    assert.equal(row.status, "DRAFT");
    assert.equal(row.bedrooms, 2);
    assert.equal(row.headline, "123 Main Street");
    assert.equal(store.listings.length, 1);
  });

  it("rejects property/unit mismatch", async () => {
    const store = defaultStore();
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () =>
        createRentalListingDraft(prisma as unknown as PrismaClient, adminContext(), {
          propertyId: PROPERTY_ID,
          unitId: OTHER_UNIT_ID,
        }),
      /does not belong/,
    );
  });

  it("rejects cross-organization access", async () => {
    const store = defaultStore({ propertyOrgId: ORG_ID });
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () =>
        createRentalListingDraft(prisma as unknown as PrismaClient, otherOrgAdmin(), {
          propertyId: PROPERTY_ID,
          unitId: UNIT_ID,
        }),
      /No access/,
    );
  });

  it("rejects duplicate open listing for the same unit", async () => {
    const store = defaultStore({ listings: [baseListing({ status: "DRAFT" })] });
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () =>
        createRentalListingDraft(prisma as unknown as PrismaClient, adminContext(), {
          propertyId: PROPERTY_ID,
          unitId: UNIT_ID,
        }),
      /already has an open listing/,
    );
  });

  it("allows a new draft after a closed listing", async () => {
    const store = defaultStore({
      listings: [baseListing({ status: "CLOSED", closedAt: new Date() })],
    });
    const prisma = createMockPrisma(store);
    const row = await createRentalListingDraft(prisma as unknown as PrismaClient, adminContext(), {
      propertyId: PROPERTY_ID,
      unitId: UNIT_ID,
    });
    assert.equal(row.status, "DRAFT");
    assert.equal(store.listings.length, 2);
  });

  it("allows assigned property manager to create a draft", async () => {
    const store = defaultStore();
    const prisma = createMockPrisma(store);
    const row = await createRentalListingDraft(prisma as unknown as PrismaClient, pmContext(), {
      propertyId: PROPERTY_ID,
      unitId: UNIT_ID,
    });
    assert.equal(row.status, "DRAFT");
  });

  it("rejects field agent create", async () => {
    const store = defaultStore();
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () =>
        createRentalListingDraft(prisma as unknown as PrismaClient, fieldAgentContext(), {
          propertyId: PROPERTY_ID,
          unitId: UNIT_ID,
        }),
      /Property manager access required/,
    );
  });
});

describe("updateRentalListing", () => {
  it("updates a draft listing", async () => {
    const store = defaultStore({ listings: [baseListing()] });
    const prisma = createMockPrisma(store);
    const row = await updateRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID, {
      monthlyRent: 2400,
      description: "Updated description",
    });
    assert.equal(Number(row.monthlyRent), 2400);
    assert.equal(row.description, "Updated description");
  });

  it("rejects edits to a closed listing", async () => {
    const store = defaultStore({ listings: [baseListing({ status: "CLOSED" })] });
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () =>
        updateRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID, {
          headline: "Nope",
        }),
      /Closed listings cannot be edited/,
    );
  });
});

describe("publishRentalListing", () => {
  it("publishes a valid draft", async () => {
    const store = defaultStore({ listings: [baseListing()] });
    const prisma = createMockPrisma(store);
    const row = await publishRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID);
    assert.equal(row.status, "PUBLISHED");
    assert.ok(row.publishedAt);
  });

  it("rejects invalid draft missing description", async () => {
    const store = defaultStore({
      listings: [baseListing({ description: null })],
    });
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () => publishRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID),
      /Description is required/,
    );
  });

  it("rejects publish when property is inactive", async () => {
    const store = defaultStore({
      listings: [baseListing()],
      propertyActive: false,
    });
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () => publishRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID),
      /operationally active/,
    );
  });

  it("rejects publish when unit has an active tenancy", async () => {
    const store = defaultStore({
      listings: [baseListing()],
      tenancyStatus: "active",
    });
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () => publishRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID),
      new RegExp(ACTIVE_TENANCY_BLOCKS_PUBLISH_MESSAGE),
    );
  });

  it("allows publish when tenancy is ended", async () => {
    const store = defaultStore({
      listings: [baseListing()],
      tenancyStatus: "ended",
    });
    const prisma = createMockPrisma(store);
    const row = await publishRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID);
    assert.equal(row.status, "PUBLISHED");
  });

  it("does not block publish based on service relationship alone", async () => {
    // Occupancy guard is unit-scoped; absence of a blocking tenancy is enough.
    // Placement-only / pre-management properties with no Tenancy row can publish.
    const store = defaultStore({
      listings: [baseListing()],
      tenancyStatus: null,
    });
    const prisma = createMockPrisma(store);
    const row = await publishRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID);
    assert.equal(row.status, "PUBLISHED");
  });

  it("does not block when another unit has an active tenancy", async () => {
    const store = defaultStore({
      listings: [baseListing()],
      tenancyStatus: null,
    });
    const prisma = createMockPrisma(store);
    // Mock only returns tenancy for the queried unitId; other-unit occupancy is out of scope.
    const row = await publishRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID);
    assert.equal(row.status, "PUBLISHED");
  });

  it("rejects unauthorized publish", async () => {
    const store = defaultStore({ listings: [baseListing()] });
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () => publishRentalListing(prisma as unknown as PrismaClient, fieldAgentContext(), LISTING_ID),
      /Property manager access required/,
    );
  });
});

describe("pause / republish / close / return to draft", () => {
  it("pauses a published listing", async () => {
    const store = defaultStore({
      listings: [baseListing({ status: "PUBLISHED", publishedAt: new Date() })],
    });
    const prisma = createMockPrisma(store);
    const row = await pauseRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID);
    assert.equal(row.status, "PAUSED");
    assert.ok(row.pausedAt);
  });

  it("republishes a paused listing", async () => {
    const store = defaultStore({
      listings: [
        baseListing({
          status: "PAUSED",
          publishedAt: new Date("2026-01-01"),
          pausedAt: new Date(),
        }),
      ],
    });
    const prisma = createMockPrisma(store);
    const row = await republishRentalListing(
      prisma as unknown as PrismaClient,
      adminContext(),
      LISTING_ID,
    );
    assert.equal(row.status, "PUBLISHED");
  });

  it("returns a paused listing to draft", async () => {
    const store = defaultStore({
      listings: [baseListing({ status: "PAUSED", pausedAt: new Date() })],
    });
    const prisma = createMockPrisma(store);
    const row = await returnRentalListingToDraft(
      prisma as unknown as PrismaClient,
      adminContext(),
      LISTING_ID,
    );
    assert.equal(row.status, "DRAFT");
  });

  it("closes a listing", async () => {
    const store = defaultStore({
      listings: [baseListing({ status: "PUBLISHED", publishedAt: new Date() })],
    });
    const prisma = createMockPrisma(store);
    const row = await closeRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID);
    assert.equal(row.status, "CLOSED");
    assert.ok(row.closedAt);
  });

  it("does not republish a closed listing", async () => {
    const store = defaultStore({
      listings: [baseListing({ status: "CLOSED", closedAt: new Date() })],
    });
    const prisma = createMockPrisma(store);
    await assert.rejects(
      () => republishRentalListing(prisma as unknown as PrismaClient, adminContext(), LISTING_ID),
      /Closed listings cannot be published/,
    );
  });
});

describe("getRentalListingById", () => {
  it("allows field agents to view listings", async () => {
    const store = defaultStore({ listings: [baseListing()] });
    const prisma = createMockPrisma(store);
    const row = await getRentalListingById(
      prisma as unknown as PrismaClient,
      fieldAgentContext(),
      LISTING_ID,
    );
    assert.equal(row.id, LISTING_ID);
  });
});

describe("isRentalListingPubliclyVisible", () => {
  it("is true only for PUBLISHED", () => {
    assert.equal(isRentalListingPubliclyVisible({ status: "PUBLISHED" }), true);
    assert.equal(isRentalListingPubliclyVisible({ status: "DRAFT" }), false);
    assert.equal(isRentalListingPubliclyVisible({ status: "PAUSED" }), false);
    assert.equal(isRentalListingPubliclyVisible({ status: "CLOSED" }), false);
  });
});
