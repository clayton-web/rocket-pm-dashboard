import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { resolvePublicRentalListingAttribution } from "./rental-listing-attribution";

function mockPrisma(listing: {
  id: string;
  propertyId: string;
  unitId: string;
  organizationId: string;
  status: string;
} | null) {
  return {
    rentalListing: {
      findUnique: async () => listing,
    },
    property: {
      findFirst: async () =>
        listing
          ? { id: listing.propertyId, organizationId: listing.organizationId }
          : null,
    },
    unit: {
      findFirst: async () => (listing ? { id: listing.unitId } : null),
    },
  } as unknown as PrismaClient;
}

describe("resolvePublicRentalListingAttribution", () => {
  it("returns null when no listing id is provided", async () => {
    const result = await resolvePublicRentalListingAttribution(mockPrisma(null), {
      propertyId: "p1",
      unitId: "u1",
    });
    assert.equal(result, null);
  });

  it("accepts a published listing matching property and unit", async () => {
    const listing = {
      id: "l1",
      propertyId: "p1",
      unitId: "u1",
      organizationId: "org1",
      status: "PUBLISHED",
    };
    const result = await resolvePublicRentalListingAttribution(mockPrisma(listing), {
      rentalListingId: "l1",
      propertyId: "p1",
      unitId: "u1",
    });
    assert.equal(result?.id, "l1");
  });

  it("rejects mismatched property", async () => {
    const listing = {
      id: "l1",
      propertyId: "p1",
      unitId: "u1",
      organizationId: "org1",
      status: "PUBLISHED",
    };
    await assert.rejects(
      () =>
        resolvePublicRentalListingAttribution(mockPrisma(listing), {
          rentalListingId: "l1",
          propertyId: "p_other",
          unitId: "u1",
        }),
      /does not match the selected property/,
    );
  });

  it("rejects draft listings", async () => {
    const listing = {
      id: "l1",
      propertyId: "p1",
      unitId: "u1",
      organizationId: "org1",
      status: "DRAFT",
    };
    await assert.rejects(
      () =>
        resolvePublicRentalListingAttribution(mockPrisma(listing), {
          rentalListingId: "l1",
          propertyId: "p1",
          unitId: "u1",
        }),
      /not currently available/,
    );
  });

  it("requires unit when listing id is provided", async () => {
    const listing = {
      id: "l1",
      propertyId: "p1",
      unitId: "u1",
      organizationId: "org1",
      status: "PUBLISHED",
    };
    await assert.rejects(
      () =>
        resolvePublicRentalListingAttribution(mockPrisma(listing), {
          rentalListingId: "l1",
          propertyId: "p1",
        }),
      /Unit is required/,
    );
  });
});
