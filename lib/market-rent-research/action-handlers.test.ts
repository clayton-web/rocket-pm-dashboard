import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { ForbiddenError } from "@/lib/services/errors";
import type { StaffContext } from "@/lib/services/staff-context";
import { handleRunMarketRentResearch } from "./action-handlers";
import { MARKET_RENT_RESEARCH_NOT_IMPLEMENTED_MESSAGE } from "./constants";

const ORG_ID = "org_test";
const PROPERTY_ID = "prop_test";
const UNIT_ID = "unit_test";

const validInputs = {
  city: "Vancouver",
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 1,
  sqft: 850,
  parking: "1 stall",
  furnished: "unfurnished",
  petPolicy: "Cats allowed",
  notes: "Corner unit",
};

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
    userId: "user_agent",
    organizationId: ORG_ID,
    organizationRole: "MEMBER",
    primaryRoleKey: "field_agent",
    assignmentRolesByProperty: new Map([[PROPERTY_ID, new Set(["field_agent"])]]),
  };
}

type MockState = {
  propertyUpdates: unknown[];
  unitUpdates: unknown[];
  tenancyWrites: unknown[];
};

function createMockPrisma(state: MockState) {
  const prisma = {
    unit: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== UNIT_ID) return null;
        return {
          id: UNIT_ID,
          propertyId: PROPERTY_ID,
          property: { id: PROPERTY_ID, organizationId: ORG_ID },
        };
      },
    },
    property: {
      findFirst: async () => ({ organizationId: ORG_ID }),
      update: async (args: unknown) => {
        state.propertyUpdates.push(args);
        throw new Error("Property write attempted");
      },
    },
    tenancy: {
      update: async (args: unknown) => {
        state.tenancyWrites.push(args);
        throw new Error("Tenancy write attempted");
      },
      updateMany: async (args: unknown) => {
        state.tenancyWrites.push(args);
        throw new Error("Tenancy write attempted");
      },
    },
  };

  return prisma;
}

describe("handleRunMarketRentResearch", () => {
  it("returns not_implemented without DB writes for authorized PM/admin", async () => {
    const state: MockState = {
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    };
    const prisma = createMockPrisma(state);

    const result = await handleRunMarketRentResearch(
      prisma as unknown as PrismaClient,
      adminContext(),
      { unitId: UNIT_ID, inputs: validInputs },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "not_implemented");
    assert.equal(result.message, MARKET_RENT_RESEARCH_NOT_IMPLEMENTED_MESSAGE);
    assert.equal(state.propertyUpdates.length, 0);
    assert.equal(state.unitUpdates.length, 0);
    assert.equal(state.tenancyWrites.length, 0);
  });

  it("denies field agents", async () => {
    const state: MockState = {
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    };
    const prisma = createMockPrisma(state);

    await assert.rejects(
      () =>
        handleRunMarketRentResearch(prisma as unknown as PrismaClient, fieldAgentContext(), {
          unitId: UNIT_ID,
          inputs: validInputs,
        }),
      (error: unknown) => error instanceof ForbiddenError,
    );
  });

  it("rejects invalid bedroom counts without side effects", async () => {
    const state: MockState = {
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    };
    const prisma = createMockPrisma(state);

    const result = await handleRunMarketRentResearch(
      prisma as unknown as PrismaClient,
      adminContext(),
      { unitId: UNIT_ID, inputs: { ...validInputs, bedrooms: -1 } },
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Bedrooms/);
    assert.equal(state.tenancyWrites.length, 0);
  });
});

describe("market rent research PR1 boundaries", () => {
  it("does not import OpenAI or scraper modules from action-handlers", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./action-handlers.ts", import.meta.url), "utf8"),
    );
    assert.doesNotMatch(source, /from ["']@\/lib\/ai\//);
    assert.doesNotMatch(source, /from ["']@\/lib\/scrapers\//);
    assert.doesNotMatch(source, /from ["'].*openai/i);
  });
});
