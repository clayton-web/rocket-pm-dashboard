import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  getInternalRentCompsForRentalAdAssistant,
  INTERNAL_RENT_COMPS_LABEL,
  medianRent,
} from "./internal-rent-comps";

const ORG_A = "org_a";
const ORG_B = "org_b";

type MockTenancyRow = {
  monthlyRent: number;
  leaseStartDate: Date;
  unit: {
    bedrooms: number | null;
    unitNumber: string;
  };
  property: {
    organizationId: string;
    name: string;
    streetLine1: string;
    streetLine2: string | null;
    city: string;
  };
};

function property(overrides: Partial<MockTenancyRow["property"]> = {}) {
  return {
    organizationId: ORG_A,
    name: "123 Main Street",
    streetLine1: "123 Main Street",
    streetLine2: null,
    city: "Vancouver",
    ...overrides,
  };
}

function row(overrides: Partial<MockTenancyRow> = {}): MockTenancyRow {
  return {
    monthlyRent: 2400,
    leaseStartDate: new Date("2025-06-01T00:00:00.000Z"),
    unit: { bedrooms: 2, unitNumber: "Entire Property" },
    property: property(),
    ...overrides,
  };
}

type MockState = {
  rows: MockTenancyRow[];
  writes: unknown[];
};

function createMockPrisma(state: MockState) {
  const prisma = {
    tenancy: {
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where: {
          monthlyRent?: { gt: number };
          leaseStartDate?: { gte: Date };
          property?: {
            organizationId?: string;
            city?: { equals: string; mode: string };
          };
        };
        orderBy?: { leaseStartDate: "desc" | "asc" };
        take?: number;
      }) => {
        let results = [...state.rows];

        if (where.monthlyRent?.gt !== undefined) {
          results = results.filter((r) => r.monthlyRent > where.monthlyRent!.gt);
        }
        if (where.leaseStartDate?.gte) {
          const cutoff = where.leaseStartDate.gte;
          results = results.filter((r) => r.leaseStartDate >= cutoff);
        }
        if (where.property?.organizationId) {
          results = results.filter(
            (r) => r.property.organizationId === where.property!.organizationId,
          );
        }
        if (where.property?.city) {
          const target = where.property.city.equals.trim().toLowerCase();
          results = results.filter(
            (r) => r.property.city.trim().toLowerCase() === target,
          );
        }

        if (orderBy?.leaseStartDate === "desc") {
          results.sort((a, b) => b.leaseStartDate.getTime() - a.leaseStartDate.getTime());
        }

        if (take !== undefined) {
          results = results.slice(0, take);
        }

        return results.map((r) => ({
          monthlyRent: r.monthlyRent,
          leaseStartDate: r.leaseStartDate,
          unit: r.unit,
          property: {
            name: r.property.name,
            streetLine1: r.property.streetLine1,
            streetLine2: r.property.streetLine2,
            city: r.property.city,
          },
        }));
      },
      update: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("tenancy.update should not be called");
      },
      create: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("tenancy.create should not be called");
      },
    },
    property: {
      update: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("property.update should not be called");
      },
    },
    unit: {
      update: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("unit.update should not be called");
      },
    },
    rentalAdAssistantDraft: {
      update: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("rentalAdAssistantDraft.update should not be called");
      },
      create: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("rentalAdAssistantDraft.create should not be called");
      },
    },
    get state() {
      return state;
    },
  };

  return prisma;
}

describe("medianRent", () => {
  it("returns null for an empty set", () => {
    assert.equal(medianRent([]), null);
  });

  it("calculates median for odd and even counts", () => {
    assert.equal(medianRent([3000, 2000, 2500]), 2500);
    assert.equal(medianRent([2000, 3000, 2400, 2600]), 2500);
  });
});

describe("getInternalRentCompsForRentalAdAssistant", () => {
  it("scopes results to the requested organization", async () => {
    const state: MockState = {
      rows: [
        row({ monthlyRent: 2200, property: property({ organizationId: ORG_A }) }),
        row({
          monthlyRent: 9999,
          property: property({ organizationId: ORG_B, streetLine1: "9 Other St" }),
        }),
      ],
      writes: [],
    };
    const prisma = createMockPrisma(state);

    const comps = await getInternalRentCompsForRentalAdAssistant(
      prisma as unknown as PrismaClient,
      { organizationId: ORG_A, city: "Vancouver", bedrooms: 2 },
    );

    assert.equal(comps.count, 1);
    assert.equal(comps.samples[0]?.monthlyLeaseRent, 2200);
    assert.equal(state.writes.length, 0);
  });

  it("matches city case-insensitively after trimming", async () => {
    const state: MockState = {
      rows: [
        row({ property: property({ city: "vancouver" }) }),
        row({
          monthlyRent: 1800,
          property: property({ city: "Victoria", streetLine1: "1 Douglas St" }),
        }),
      ],
      writes: [],
    };
    const prisma = createMockPrisma(state);

    const comps = await getInternalRentCompsForRentalAdAssistant(
      prisma as unknown as PrismaClient,
      { organizationId: ORG_A, city: "  VANCOUVER ", bedrooms: 2 },
    );

    assert.equal(comps.count, 1);
    assert.equal(comps.query.city, "VANCOUVER");
    assert.equal(comps.samples.length, 1);
  });

  it("matches bedrooms within ±1 and excludes null-bedroom units when filtering", async () => {
    const state: MockState = {
      rows: [
        row({ monthlyRent: 2000, unit: { bedrooms: 1, unitNumber: "Basement" } }),
        row({ monthlyRent: 2400, unit: { bedrooms: 2, unitNumber: "Upper" } }),
        row({ monthlyRent: 2600, unit: { bedrooms: 3, unitNumber: "Suite A" } }),
        row({ monthlyRent: 5000, unit: { bedrooms: 4, unitNumber: "Penthouse" } }),
        row({ monthlyRent: 1900, unit: { bedrooms: null, unitNumber: "Unknown" } }),
      ],
      writes: [],
    };
    const prisma = createMockPrisma(state);

    const comps = await getInternalRentCompsForRentalAdAssistant(
      prisma as unknown as PrismaClient,
      { organizationId: ORG_A, city: "Vancouver", bedrooms: 2 },
    );

    assert.equal(comps.count, 3);
    assert.deepEqual(
      comps.samples.map((s) => s.monthlyLeaseRent).sort((a, b) => a - b),
      [2000, 2400, 2600],
    );
    assert.equal(comps.query.bedroomsMin, 1);
    assert.equal(comps.query.bedroomsMax, 3);
  });

  it("returns city-level comps when bedrooms input is omitted", async () => {
    const state: MockState = {
      rows: [
        row({ monthlyRent: 2000, unit: { bedrooms: 1, unitNumber: "Basement" } }),
        row({ monthlyRent: 2600, unit: { bedrooms: 3, unitNumber: "Suite A" } }),
      ],
      writes: [],
    };
    const prisma = createMockPrisma(state);

    const comps = await getInternalRentCompsForRentalAdAssistant(
      prisma as unknown as PrismaClient,
      { organizationId: ORG_A, city: "Vancouver" },
    );

    assert.equal(comps.count, 2);
    assert.equal(comps.query.bedroomsMin, 0);
    assert.equal(comps.query.bedroomsMax, 50);
  });

  it("excludes zero and non-positive rents", async () => {
    const state: MockState = {
      rows: [
        row({ monthlyRent: 0 }),
        row({ monthlyRent: -100, unit: { bedrooms: 2, unitNumber: "Bad" } }),
        row({ monthlyRent: 2300, unit: { bedrooms: 2, unitNumber: "Good" } }),
      ],
      writes: [],
    };
    const prisma = createMockPrisma(state);

    const comps = await getInternalRentCompsForRentalAdAssistant(
      prisma as unknown as PrismaClient,
      { organizationId: ORG_A, city: "Vancouver", bedrooms: 2 },
    );

    assert.equal(comps.count, 1);
    assert.equal(comps.min, 2300);
    assert.equal(comps.max, 2300);
    assert.equal(comps.median, 2300);
  });

  it("calculates median/min/max from the full matching set before sample limiting", async () => {
    const state: MockState = {
      rows: [
        row({ monthlyRent: 2000, leaseStartDate: new Date("2025-01-01T00:00:00.000Z") }),
        row({ monthlyRent: 2200, leaseStartDate: new Date("2025-02-01T00:00:00.000Z") }),
        row({ monthlyRent: 2400, leaseStartDate: new Date("2025-03-01T00:00:00.000Z") }),
        row({ monthlyRent: 2600, leaseStartDate: new Date("2025-04-01T00:00:00.000Z") }),
        row({ monthlyRent: 2800, leaseStartDate: new Date("2025-05-01T00:00:00.000Z") }),
      ],
      writes: [],
    };
    const prisma = createMockPrisma(state);

    const comps = await getInternalRentCompsForRentalAdAssistant(
      prisma as unknown as PrismaClient,
      { organizationId: ORG_A, city: "Vancouver", bedrooms: 2, limit: 2 },
    );

    assert.equal(comps.count, 5);
    assert.equal(comps.min, 2000);
    assert.equal(comps.max, 2800);
    assert.equal(comps.median, 2400);
    assert.equal(comps.samples.length, 2);
    assert.equal(comps.samples[0]?.monthlyLeaseRent, 2800);
    assert.equal(comps.samples[1]?.monthlyLeaseRent, 2600);
  });

  it("returns null stats and an empty sample list when no comps exist", async () => {
    const state: MockState = { rows: [], writes: [] };
    const prisma = createMockPrisma(state);

    const comps = await getInternalRentCompsForRentalAdAssistant(
      prisma as unknown as PrismaClient,
      { organizationId: ORG_A, city: "Vancouver", bedrooms: 2 },
    );

    assert.equal(comps.label, INTERNAL_RENT_COMPS_LABEL);
    assert.equal(comps.count, 0);
    assert.equal(comps.median, null);
    assert.equal(comps.min, null);
    assert.equal(comps.max, null);
    assert.deepEqual(comps.samples, []);
    assert.equal(comps.query.monthsBack, 24);
  });

  it("labels results as historical lease rents, not asking rent", async () => {
    const state: MockState = {
      rows: [row({ monthlyRent: 2500 })],
      writes: [],
    };
    const prisma = createMockPrisma(state);

    const comps = await getInternalRentCompsForRentalAdAssistant(
      prisma as unknown as PrismaClient,
      { organizationId: ORG_A, city: "Vancouver", bedrooms: 2 },
    );

    assert.match(comps.label, /Historical lease rents from signed leases/);
    assert.equal("monthlyRent" in (comps.samples[0] ?? {}), false);
    assert.equal(comps.samples[0]?.monthlyLeaseRent, 2500);
    assert.equal(state.writes.length, 0);
  });
});
