import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { StaffContext } from "./staff-context";
import {
  ListingSelectionRequiredError,
  PlacementCompletionNotAllowedError,
  completeTenantPlacement,
} from "./tenant-placement.service";

const ORG_ID = "org_test";
const PROPERTY_ID = "prop_test";
const UNIT_ID = "unit_test";
const APP_ID = "app_test";
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

function createMockPrisma(args: {
  serviceRelationship: "MANAGED" | "PRE_MANAGEMENT" | "PLACEMENT_ONLY";
  applicationStatus?: string;
  rentalListingId?: string | null;
  existingPlacement?: boolean;
  existingTenancy?: boolean;
  listingStatus?: "PUBLISHED" | "CLOSED" | "DRAFT";
  openListingCount?: number;
}) {
  let listingStatus = args.listingStatus ?? "PUBLISHED";
  const created: {
    placement: boolean;
    tenancy: boolean;
    listingClosed: boolean;
  } = { placement: false, tenancy: false, listingClosed: false };

  const listing = {
    id: LISTING_ID,
    propertyId: PROPERTY_ID,
    unitId: UNIT_ID,
    organizationId: ORG_ID,
    status: listingStatus,
    pausedAt: null,
    closedAt: null,
    monthlyRent: 2000,
    availableDate: null,
    bedrooms: 2,
    approxSqft: null,
    headline: "Bright suite",
    publishedAt: new Date(),
  };

  const prisma = {
    $transaction: async <T>(fn: (tx: PrismaClient) => Promise<T>) =>
      fn(prisma as unknown as PrismaClient),
    application: {
      findUnique: async () => ({
        id: APP_ID,
        status: args.applicationStatus ?? "approved",
        propertyId: PROPERTY_ID,
        unitId: UNIT_ID,
        rentalListingId: args.rentalListingId === undefined ? LISTING_ID : args.rentalListingId,
        property: {
          id: PROPERTY_ID,
          organizationId: ORG_ID,
          serviceRelationship: args.serviceRelationship,
        },
        tenancy: args.existingTenancy ? { id: "ten_1" } : null,
        tenantPlacement: args.existingPlacement ? { id: "place_1" } : null,
      }),
    },
    tenantPlacement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.placement = true;
        return {
          id: "place_new",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "place_new",
        organizationId: ORG_ID,
        propertyId: PROPERTY_ID,
        unitId: UNIT_ID,
        applicationId: APP_ID,
        rentalListingId: LISTING_ID,
        status: "completed",
        leaseStartDate: new Date("2026-08-01"),
        leaseEndDate: null,
        monthlyRent: 2100,
        completedAt: new Date(),
        rentalListingClosed: Boolean(data.rentalListingClosed),
        ...data,
      }),
    },
    tenancy: {
      create: async () => {
        created.tenancy = true;
        return { id: "ten_new" };
      },
    },
    rentalListing: {
      findUnique: async () => ({ ...listing, status: listingStatus }),
      findMany: async () => {
        const count = args.openListingCount ?? (args.rentalListingId === null ? 0 : 1);
        if (count === 0) return [];
        if (count > 1) {
          return [
            { id: "l1", headline: "A", status: "PUBLISHED" },
            { id: "l2", headline: "B", status: "DRAFT" },
          ];
        }
        return [{ id: LISTING_ID, headline: "Bright suite", status: listingStatus }];
      },
      update: async ({ data }: { data: { status: string } }) => {
        listingStatus = data.status as typeof listingStatus;
        if (data.status === "CLOSED") created.listingClosed = true;
        return { ...listing, status: listingStatus, closedAt: new Date() };
      },
    },
    property: {
      findFirst: async () => ({ id: PROPERTY_ID, organizationId: ORG_ID }),
    },
    activityLog: {
      create: async () => ({}),
    },
    get created() {
      return created;
    },
    get listingStatus() {
      return listingStatus;
    },
  };

  return prisma;
}

const placementInput = {
  applicationId: APP_ID,
  leaseStartDate: new Date("2026-08-01T12:00:00.000Z"),
  monthlyRent: 2100,
};

describe("completeTenantPlacement", () => {
  it("completes placement-only and closes the attributed listing", async () => {
    const prisma = createMockPrisma({ serviceRelationship: "PLACEMENT_ONLY" });
    const row = await completeTenantPlacement(
      prisma as unknown as PrismaClient,
      adminContext(),
      placementInput,
    );
    assert.equal(prisma.created.placement, true);
    assert.equal(prisma.created.tenancy, false);
    assert.equal(prisma.created.listingClosed, true);
    assert.equal(prisma.listingStatus, "CLOSED");
    assert.ok(row.id);
  });

  it("blocks managed properties from placement completion", async () => {
    const prisma = createMockPrisma({ serviceRelationship: "MANAGED" });
    await assert.rejects(
      () =>
        completeTenantPlacement(
          prisma as unknown as PrismaClient,
          adminContext(),
          placementInput,
        ),
      PlacementCompletionNotAllowedError,
    );
    assert.equal(prisma.created.placement, false);
    assert.equal(prisma.created.listingClosed, false);
  });

  it("blocks duplicate placement", async () => {
    const prisma = createMockPrisma({
      serviceRelationship: "PLACEMENT_ONLY",
      existingPlacement: true,
    });
    await assert.rejects(() =>
      completeTenantPlacement(prisma as unknown as PrismaClient, adminContext(), placementInput),
    );
    assert.equal(prisma.created.placement, false);
  });

  it("blocks when a managed tenancy already exists", async () => {
    const prisma = createMockPrisma({
      serviceRelationship: "PLACEMENT_ONLY",
      existingTenancy: true,
    });
    await assert.rejects(() =>
      completeTenantPlacement(prisma as unknown as PrismaClient, adminContext(), placementInput),
    );
  });

  it("requires listing selection when unattributed and multiple open listings exist", async () => {
    const prisma = createMockPrisma({
      serviceRelationship: "PLACEMENT_ONLY",
      rentalListingId: null,
      openListingCount: 2,
    });
    await assert.rejects(
      () =>
        completeTenantPlacement(
          prisma as unknown as PrismaClient,
          adminContext(),
          placementInput,
        ),
      ListingSelectionRequiredError,
    );
    assert.equal(prisma.created.listingClosed, false);
  });
});
