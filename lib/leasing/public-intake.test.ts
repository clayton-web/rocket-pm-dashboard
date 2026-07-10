import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  listLegacyActiveUnitsWithoutListingHistory,
  listPublicLeasingSubmitOptions,
  listPublishedRentalListingSubmitOptions,
} from "./public-intake";
import { isRentalListingPublicFallbackEnabled } from "./rental-listing-public-fallback";

const ORG_ID = "org_public";
const OTHER_ORG_ID = "org_other";

const originalFallback = process.env.RENTAL_LISTING_PUBLIC_FALLBACK;
const originalSlug = process.env.MAINTENANCE_PUBLIC_ORG_SLUG;

afterEach(() => {
  if (originalFallback === undefined) delete process.env.RENTAL_LISTING_PUBLIC_FALLBACK;
  else process.env.RENTAL_LISTING_PUBLIC_FALLBACK = originalFallback;
  if (originalSlug === undefined) delete process.env.MAINTENANCE_PUBLIC_ORG_SLUG;
  else process.env.MAINTENANCE_PUBLIC_ORG_SLUG = originalSlug;
});

type ListingRow = {
  id: string;
  organizationId: string;
  propertyId: string;
  unitId: string;
  status: string;
  monthlyRent: Prisma.Decimal | null;
  availableDate: Date | null;
  bedrooms: number | null;
  bathrooms: Prisma.Decimal | null;
  approxSqft: number | null;
  headline: string | null;
  description: string | null;
  property: { id: string; name: string; isActive: boolean; organizationId: string };
  unit: { id: string; unitNumber: string; isActive: boolean };
};

type PropertyRow = {
  id: string;
  name: string;
  organizationId: string;
  isActive: boolean;
  units: { id: string; unitNumber: string; isActive: boolean; listingCount: number }[];
};

function createMockDb(args: { listings: ListingRow[]; properties: PropertyRow[] }) {
  return {
    organization: {
      findFirst: async () => ({ id: ORG_ID }),
    },
    rentalListing: {
      findMany: async ({
        where,
      }: {
        where: {
          organizationId: string;
          status: string;
          property: { isActive: boolean; organizationId: string };
          unit: { isActive: boolean };
        };
      }) => {
        return args.listings.filter((l) => {
          if (l.organizationId !== where.organizationId) return false;
          if (l.status !== where.status) return false;
          if (!l.property.isActive || l.property.organizationId !== where.property.organizationId) {
            return false;
          }
          if (!l.unit.isActive) return false;
          return true;
        });
      },
    },
    property: {
      findMany: async ({
        where,
      }: {
        where: { organizationId: string; isActive: boolean };
        include?: {
          units: {
            where: { isActive: boolean; rentalListings: { none: Record<string, never> } };
          };
        };
      }) => {
        return args.properties
          .filter((p) => p.organizationId === where.organizationId && p.isActive === where.isActive)
          .map((p) => ({
            id: p.id,
            name: p.name,
            units: p.units
              .filter((u) => u.isActive && u.listingCount === 0)
              .map((u) => ({ id: u.id, unitNumber: u.unitNumber })),
          }));
      },
    },
  } as unknown as PrismaClient;
}

function publishedListing(overrides: Partial<ListingRow> & Pick<ListingRow, "id" | "unitId">): ListingRow {
  return {
    organizationId: ORG_ID,
    propertyId: "p1",
    status: "PUBLISHED",
    monthlyRent: new Prisma.Decimal(2000),
    availableDate: new Date("2026-08-01T00:00:00.000Z"),
    bedrooms: 2,
    bathrooms: new Prisma.Decimal(1),
    approxSqft: 700,
    headline: "Nice place",
    description: "Desc",
    property: { id: "p1", name: "123 Main", isActive: true, organizationId: ORG_ID },
    unit: { id: overrides.unitId, unitNumber: "1", isActive: true },
    ...overrides,
  };
}

describe("isRentalListingPublicFallbackEnabled", () => {
  it("defaults on when unset or empty", () => {
    delete process.env.RENTAL_LISTING_PUBLIC_FALLBACK;
    assert.equal(isRentalListingPublicFallbackEnabled(), true);
    process.env.RENTAL_LISTING_PUBLIC_FALLBACK = "  ";
    assert.equal(isRentalListingPublicFallbackEnabled(), true);
  });

  it("parses true forms", () => {
    for (const value of ["true", "TRUE", "1", "yes", " Yes "]) {
      process.env.RENTAL_LISTING_PUBLIC_FALLBACK = value;
      assert.equal(isRentalListingPublicFallbackEnabled(), true, value);
    }
  });

  it("parses false forms including the string false", () => {
    for (const value of ["false", "FALSE", "0", "no", " No "]) {
      process.env.RENTAL_LISTING_PUBLIC_FALLBACK = value;
      assert.equal(isRentalListingPublicFallbackEnabled(), false, value);
    }
  });

  it("fails closed for unknown non-empty values", () => {
    process.env.RENTAL_LISTING_PUBLIC_FALLBACK = "maybe";
    assert.equal(isRentalListingPublicFallbackEnabled(), false);
  });
});

describe("listPublishedRentalListingSubmitOptions", () => {
  it("returns published listings for the public org only", async () => {
    process.env.MAINTENANCE_PUBLIC_ORG_SLUG = "axford";
    const db = createMockDb({
      listings: [
        publishedListing({ id: "l1", unitId: "u1" }),
        publishedListing({
          id: "l-draft",
          unitId: "u2",
          status: "DRAFT",
          unit: { id: "u2", unitNumber: "2", isActive: true },
        }),
        publishedListing({
          id: "l-other-org",
          unitId: "u9",
          organizationId: OTHER_ORG_ID,
          propertyId: "p9",
          property: {
            id: "p9",
            name: "Other",
            isActive: true,
            organizationId: OTHER_ORG_ID,
          },
          unit: { id: "u9", unitNumber: "1", isActive: true },
        }),
        publishedListing({
          id: "l-inactive-unit",
          unitId: "u5",
          propertyId: "p2",
          property: { id: "p2", name: "456 Oak", isActive: true, organizationId: ORG_ID },
          unit: { id: "u5", unitNumber: "1", isActive: false },
        }),
      ],
      properties: [],
    });

    const options = await listPublishedRentalListingSubmitOptions(db);
    assert.equal(options.length, 1);
    assert.equal(options[0]?.units[0]?.rentalListingId, "l1");
    assert.equal(options[0]?.units[0]?.isPublishedListing, true);
  });
});

describe("per-unit public fallback merge", () => {
  it("keeps untouched legacy units when another unit is published", async () => {
    process.env.MAINTENANCE_PUBLIC_ORG_SLUG = "axford";
    delete process.env.RENTAL_LISTING_PUBLIC_FALLBACK;
    const db = createMockDb({
      listings: [publishedListing({ id: "l1", unitId: "u-published", unit: { id: "u-published", unitNumber: "A", isActive: true } })],
      properties: [
        {
          id: "p1",
          name: "123 Main",
          organizationId: ORG_ID,
          isActive: true,
          units: [
            { id: "u-published", unitNumber: "A", isActive: true, listingCount: 1 },
            { id: "u-legacy", unitNumber: "B", isActive: true, listingCount: 0 },
            { id: "u-draft", unitNumber: "C", isActive: true, listingCount: 1 },
            { id: "u-paused", unitNumber: "D", isActive: true, listingCount: 1 },
            { id: "u-closed", unitNumber: "E", isActive: true, listingCount: 1 },
            { id: "u-inactive", unitNumber: "F", isActive: false, listingCount: 0 },
          ],
        },
      ],
    });

    const options = await listPublicLeasingSubmitOptions(db);
    assert.equal(options.length, 1);
    const unitIds = options[0]?.units.map((u) => u.unitId).sort() ?? [];
    assert.deepEqual(unitIds, ["u-legacy", "u-published"]);
    const published = options[0]?.units.find((u) => u.unitId === "u-published");
    const legacy = options[0]?.units.find((u) => u.unitId === "u-legacy");
    assert.equal(published?.isPublishedListing, true);
    assert.equal(published?.rentalListingId, "l1");
    assert.equal(legacy?.isPublishedListing, false);
    assert.equal(legacy?.rentalListingId, undefined);
  });

  it("excludes draft/paused/closed units from legacy fallback", async () => {
    process.env.MAINTENANCE_PUBLIC_ORG_SLUG = "axford";
    delete process.env.RENTAL_LISTING_PUBLIC_FALLBACK;
    const db = createMockDb({
      listings: [],
      properties: [
        {
          id: "p1",
          name: "123 Main",
          organizationId: ORG_ID,
          isActive: true,
          units: [
            { id: "u-none", unitNumber: "1", isActive: true, listingCount: 0 },
            { id: "u-has-history", unitNumber: "2", isActive: true, listingCount: 1 },
          ],
        },
      ],
    });
    const legacy = await listLegacyActiveUnitsWithoutListingHistory(db);
    assert.equal(legacy[0]?.units.length, 1);
    assert.equal(legacy[0]?.units[0]?.unitId, "u-none");
  });

  it("returns only published when fallback disabled", async () => {
    process.env.MAINTENANCE_PUBLIC_ORG_SLUG = "axford";
    process.env.RENTAL_LISTING_PUBLIC_FALLBACK = "false";
    const db = createMockDb({
      listings: [publishedListing({ id: "l1", unitId: "u1" })],
      properties: [
        {
          id: "p1",
          name: "123 Main",
          organizationId: ORG_ID,
          isActive: true,
          units: [
            { id: "u1", unitNumber: "1", isActive: true, listingCount: 1 },
            { id: "u2", unitNumber: "2", isActive: true, listingCount: 0 },
          ],
        },
      ],
    });
    const options = await listPublicLeasingSubmitOptions(db);
    assert.equal(options[0]?.units.length, 1);
    assert.equal(options[0]?.units[0]?.unitId, "u1");
  });

  it("returns empty when fallback disabled and no published listings", async () => {
    process.env.MAINTENANCE_PUBLIC_ORG_SLUG = "axford";
    process.env.RENTAL_LISTING_PUBLIC_FALLBACK = "false";
    const db = createMockDb({
      listings: [],
      properties: [
        {
          id: "p1",
          name: "123 Main",
          organizationId: ORG_ID,
          isActive: true,
          units: [{ id: "u1", unitNumber: "1", isActive: true, listingCount: 0 }],
        },
      ],
    });
    assert.deepEqual(await listPublicLeasingSubmitOptions(db), []);
  });

  it("excludes other organizations from legacy fallback", async () => {
    process.env.MAINTENANCE_PUBLIC_ORG_SLUG = "axford";
    delete process.env.RENTAL_LISTING_PUBLIC_FALLBACK;
    const db = createMockDb({
      listings: [],
      properties: [
        {
          id: "p-other",
          name: "Other",
          organizationId: OTHER_ORG_ID,
          isActive: true,
          units: [{ id: "u-other", unitNumber: "1", isActive: true, listingCount: 0 }],
        },
      ],
    });
    assert.deepEqual(await listLegacyActiveUnitsWithoutListingHistory(db), []);
  });
});
