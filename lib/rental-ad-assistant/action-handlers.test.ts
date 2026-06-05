import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient, RentalAdAssistantDraft } from "@prisma/client";
import { INTERNAL_RENT_COMPS_LABEL } from "@/lib/leasing/internal-rent-comps";
import { ForbiddenError } from "@/lib/services/errors";
import type { StaffContext } from "@/lib/services/staff-context";
import type { RentalAdAssistantInputs, RentalAdAssistantOutput } from "@/lib/validation/rental-ad-assistant";
import {
  handleGenerateRentalAdAssistantDraft,
  handleLoadRentalAdAssistantDraft,
  handleSaveRentalAdAssistantDraft,
} from "./action-handlers";

const ORG_ID = "org_test";
const PROPERTY_ID = "prop_test";
const UNIT_ID = "unit_test";

const sampleInputs: RentalAdAssistantInputs = {
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 1,
  sqft: 850,
  parking: "1 stall",
  utilitiesIncluded: ["water"],
  petPolicy: "Cats allowed",
  furnished: "unfurnished",
  availableDate: "2026-07-01",
};

const sampleOutput: RentalAdAssistantOutput = {
  suggestedAdvertisingRent: {
    conservative: 2200,
    recommended: 2400,
    aggressive: 2550,
    currency: "CAD",
  },
  confidence: "low",
  confidenceReason: "Limited comps.",
  explanation: "Suggested advertising rent only.",
  headline: "Bright 2BR condo",
  fullDescription: "Full ad copy.",
  shortDescription: "Short ad copy.",
  valueAddSuggestions: ["Fresh paint"],
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
  drafts: RentalAdAssistantDraft[];
  propertyUpdates: unknown[];
  unitUpdates: unknown[];
  tenancyWrites: unknown[];
};

function draftRow(overrides: Partial<RentalAdAssistantDraft> = {}): RentalAdAssistantDraft {
  const now = new Date("2026-06-01T12:00:00.000Z");
  return {
    id: "draft_test",
    organizationId: ORG_ID,
    propertyId: PROPERTY_ID,
    unitId: UNIT_ID,
    createdByUserId: "user_admin",
    updatedByUserId: "user_admin",
    inputsJson: sampleInputs,
    outputJson: null,
    compsSnapshotJson: null,
    model: null,
    promptVersion: null,
    lastGeneratedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockPrisma(state: MockState) {
  const prisma = {
    unit: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== UNIT_ID) return null;
        return {
          id: UNIT_ID,
          propertyId: PROPERTY_ID,
          unitNumber: "Entire Property",
          bedrooms: 2,
          property: {
            id: PROPERTY_ID,
            organizationId: ORG_ID,
            name: "123 Main Street",
            streetLine1: "123 Main Street",
            streetLine2: null,
            city: "Vancouver",
            province: "BC",
            postalCode: "V6B 1A1",
          },
        };
      },
    },
    property: {
      findFirst: async () => ({ organizationId: ORG_ID }),
      count: async () => 1,
      update: async (args: unknown) => {
        state.propertyUpdates.push(args);
        throw new Error("property.update should not be called");
      },
    },
    tenancy: {
      findMany: async () => [],
      update: async (args: unknown) => {
        state.tenancyWrites.push(args);
        throw new Error("tenancy.update should not be called");
      },
      create: async (args: unknown) => {
        state.tenancyWrites.push(args);
        throw new Error("tenancy.create should not be called");
      },
    },
    rentalAdAssistantDraft: {
      findFirst: async ({
        where,
      }: {
        where: { unitId?: string; organizationId?: string; id?: string };
      }) =>
        state.drafts.find(
          (d) =>
            (where.unitId === undefined || d.unitId === where.unitId) &&
            (where.organizationId === undefined || d.organizationId === where.organizationId) &&
            (where.id === undefined || d.id === where.id),
        ) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { unitId: string };
        create: Omit<RentalAdAssistantDraft, "id" | "createdAt" | "updatedAt">;
        update: Partial<RentalAdAssistantDraft>;
      }) => {
        const existing = state.drafts.find((d) => d.unitId === where.unitId);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date("2026-06-02T12:00:00.000Z") });
          return existing;
        }
        const created = draftRow({ id: "draft_new", ...create, inputsJson: create.inputsJson });
        state.drafts.push(created);
        return created;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<RentalAdAssistantDraft>;
      }) => {
        const existing = state.drafts.find((d) => d.id === where.id);
        if (!existing) throw new Error("Draft not found");
        Object.assign(existing, data, { updatedAt: new Date("2026-06-03T12:00:00.000Z") });
        return existing;
      },
    },
    get state() {
      return state;
    },
  };

  return prisma;
}

describe("rental-ad-assistant action handlers", () => {
  it("denies field agents from loading drafts", async () => {
    const prisma = createMockPrisma({
      drafts: [],
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    });

    await assert.rejects(
      () => handleLoadRentalAdAssistantDraft(prisma as unknown as PrismaClient, fieldAgentContext(), UNIT_ID),
      ForbiddenError,
    );
  });

  it("saves inputs only to RentalAdAssistantDraft", async () => {
    const state: MockState = {
      drafts: [],
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    };
    const prisma = createMockPrisma(state);

    const result = await handleSaveRentalAdAssistantDraft(prisma as unknown as PrismaClient, adminContext(), {
      unitId: UNIT_ID,
      inputs: sampleInputs,
    });

    assert.equal(result.ok, true);
    if (!result.ok || !result.draft) return;
    assert.equal(result.draft.inputs?.propertyType, "condo");
    assert.equal(state.drafts.length, 1);
    assert.equal(state.propertyUpdates.length, 0);
    assert.equal(state.tenancyWrites.length, 0);
  });

  it("recalculates review flags when edited output is saved", async () => {
    const state: MockState = {
      drafts: [draftRow()],
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    };
    const prisma = createMockPrisma(state);

    const edited = {
      ...sampleOutput,
      headline: "Quiet suite for professionals only",
      fullDescription: "Edited full description",
      reviewFlags: [],
    };

    const result = await handleSaveRentalAdAssistantDraft(prisma as unknown as PrismaClient, adminContext(), {
      unitId: UNIT_ID,
      inputs: sampleInputs,
      output: edited,
    });

    assert.equal(result.ok, true);
    if (!result.ok || !result.draft) return;
    assert.ok(result.draft.output?.reviewFlags?.includes("professionals_only"));
  });

  it("saves edited output to the draft table", async () => {
    const state: MockState = {
      drafts: [draftRow()],
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    };
    const prisma = createMockPrisma(state);

    const edited = {
      ...sampleOutput,
      headline: "Edited headline",
      fullDescription: "Edited full description",
    };

    const result = await handleSaveRentalAdAssistantDraft(prisma as unknown as PrismaClient, adminContext(), {
      unitId: UNIT_ID,
      inputs: sampleInputs,
      output: edited,
    });

    assert.equal(result.ok, true);
    if (!result.ok || !result.draft) return;
    assert.equal(result.draft.output?.headline, "Edited headline");
    assert.equal(state.propertyUpdates.length, 0);
  });

  it("generates and persists output plus comps snapshot", async () => {
    const state: MockState = {
      drafts: [],
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    };
    const prisma = createMockPrisma(state);

    const result = await handleGenerateRentalAdAssistantDraft(
      prisma as unknown as PrismaClient,
      adminContext(),
      {
        unitId: UNIT_ID,
        inputs: sampleInputs,
        createCompletion: async () => sampleOutput,
      },
    );

    assert.equal(result.ok, true);
    if (!result.ok || !result.draft) return;
    assert.equal(result.draft.output?.suggestedAdvertisingRent.recommended, 2400);
    assert.equal(result.draft.compsSnapshot?.label, INTERNAL_RENT_COMPS_LABEL);
    assert.equal(result.draft.promptVersion, "rental-ad-assistant-v1");
    assert.equal("monthlyRent" in (result.draft.output ?? {}), false);
    assert.equal(state.propertyUpdates.length, 0);
    assert.equal(state.tenancyWrites.length, 0);
  });

  it("persists review flags from generated output", async () => {
    const state: MockState = {
      drafts: [],
      propertyUpdates: [],
      unitUpdates: [],
      tenancyWrites: [],
    };
    const prisma = createMockPrisma(state);

    const result = await handleGenerateRentalAdAssistantDraft(
      prisma as unknown as PrismaClient,
      adminContext(),
      {
        unitId: UNIT_ID,
        inputs: sampleInputs,
        createCompletion: async () => ({
          ...sampleOutput,
          fullDescription: "No children — adults only preferred.",
        }),
      },
    );

    assert.equal(result.ok, true);
    if (!result.ok || !result.draft) return;
    assert.ok(result.draft.output?.reviewFlags?.includes("no_children"));
    assert.ok(result.draft.output?.reviewFlags?.includes("adults_only"));
  });
});
