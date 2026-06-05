import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient, type RentalAdAssistantDraft } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "./errors";
import type { StaffContext } from "./staff-context";
import {
  clearRentalAdAssistantDraftOutput,
  getRentalAdAssistantDraftForUnit,
  saveRentalAdAssistantDraftInputs,
  saveRentalAdAssistantDraftOutput,
} from "./rental-ad-assistant-draft.service";
import type {
  RentalAdAssistantInputs,
  RentalAdAssistantOutput,
} from "@/lib/validation/rental-ad-assistant";

const ORG_ID = "org_test";
const OTHER_ORG_ID = "org_other";
const PROPERTY_ID = "prop_test";
const UNIT_ID = "unit_test";

const sampleInputs: RentalAdAssistantInputs = {
  propertyType: "house",
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1200,
  parking: "Driveway",
  utilitiesIncluded: ["water"],
  petPolicy: "No pets",
  furnished: "unfurnished",
  availableDate: "now",
};

const sampleOutput: RentalAdAssistantOutput = {
  suggestedAdvertisingRent: {
    conservative: 2800,
    recommended: 3000,
    aggressive: 3200,
    currency: "CAD",
  },
  confidence: "low",
  confidenceReason: "No portfolio comps.",
  explanation: "Estimate based on PM inputs only.",
  headline: "3BR house",
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

type MockState = {
  drafts: RentalAdAssistantDraft[];
  propertyUpdates: unknown[];
  unitUpdates: unknown[];
  tenancyUpdates: unknown[];
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
          property: { id: PROPERTY_ID, organizationId: ORG_ID },
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
    rentalAdAssistantDraft: {
      findFirst: async ({
        where,
      }: {
        where: { unitId?: string; organizationId?: string; id?: string };
      }) => {
        return (
          state.drafts.find(
            (d) =>
              (where.unitId === undefined || d.unitId === where.unitId) &&
              (where.organizationId === undefined || d.organizationId === where.organizationId) &&
              (where.id === undefined || d.id === where.id),
          ) ?? null
        );
      },
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
        const created = draftRow({
          id: "draft_new",
          ...create,
          inputsJson: create.inputsJson,
        });
        state.drafts.push(created);
        return created;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<RentalAdAssistantDraft> & Record<string, unknown>;
      }) => {
        const existing = state.drafts.find((d) => d.id === where.id);
        if (!existing) throw new Error("Draft not found");
        const normalized = Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            value === Prisma.DbNull || value === Prisma.JsonNull ? null : value,
          ]),
        ) as Partial<RentalAdAssistantDraft>;
        Object.assign(existing, normalized, { updatedAt: new Date("2026-06-03T12:00:00.000Z") });
        return existing;
      },
    },
    unitUpdate: {
      update: async (args: unknown) => {
        state.unitUpdates.push(args);
        throw new Error("unit.update should not be called");
      },
    },
    tenancy: {
      update: async (args: unknown) => {
        state.tenancyUpdates.push(args);
        throw new Error("tenancy.update should not be called");
      },
    },
    get state() {
      return state;
    },
  };

  return prisma;
}

describe("rental-ad-assistant-draft.service", () => {
  it("returns null when no draft exists for an authorized PM", async () => {
    const prisma = createMockPrisma({ drafts: [], propertyUpdates: [], unitUpdates: [], tenancyUpdates: [] });
    const draft = await getRentalAdAssistantDraftForUnit(
      prisma as unknown as PrismaClient,
      pmContext(),
      UNIT_ID,
    );
    assert.equal(draft, null);
  });

  it("allows org admin to save draft inputs without touching Property/Unit/Tenancy", async () => {
    const state: MockState = { drafts: [], propertyUpdates: [], unitUpdates: [], tenancyUpdates: [] };
    const prisma = createMockPrisma(state);

    const saved = await saveRentalAdAssistantDraftInputs(
      prisma as unknown as PrismaClient,
      adminContext(),
      UNIT_ID,
      sampleInputs,
    );

    assert.equal(saved.unitId, UNIT_ID);
    assert.equal(saved.organizationId, ORG_ID);
    assert.deepEqual(saved.inputsJson, sampleInputs);
    assert.equal(state.drafts.length, 1);
    assert.equal(state.propertyUpdates.length, 0);
    assert.equal(state.unitUpdates.length, 0);
    assert.equal(state.tenancyUpdates.length, 0);
  });

  it("denies field agents without property manager access", async () => {
    const prisma = createMockPrisma({ drafts: [], propertyUpdates: [], unitUpdates: [], tenancyUpdates: [] });

    await assert.rejects(
      () =>
        saveRentalAdAssistantDraftInputs(
          prisma as unknown as PrismaClient,
          fieldAgentContext(),
          UNIT_ID,
          sampleInputs,
        ),
      ForbiddenError,
    );
  });

  it("scopes drafts to the active organization", async () => {
    const prisma = createMockPrisma({ drafts: [], propertyUpdates: [], unitUpdates: [], tenancyUpdates: [] });
    const otherOrgContext: StaffContext = {
      ...adminContext(),
      organizationId: OTHER_ORG_ID,
    };

    prisma.unit.findUnique = async () => ({
      id: UNIT_ID,
      propertyId: PROPERTY_ID,
      property: { id: PROPERTY_ID, organizationId: ORG_ID },
    });

    await assert.rejects(
      () =>
        getRentalAdAssistantDraftForUnit(
          prisma as unknown as PrismaClient,
          otherOrgContext,
          UNIT_ID,
        ),
      ForbiddenError,
    );
  });

  it("updates draft output without writing official rent fields elsewhere", async () => {
    const state: MockState = {
      drafts: [draftRow()],
      propertyUpdates: [],
      unitUpdates: [],
      tenancyUpdates: [],
    };
    const prisma = createMockPrisma(state);

    const updated = await saveRentalAdAssistantDraftOutput(
      prisma as unknown as PrismaClient,
      pmContext(),
      UNIT_ID,
      {
        output: sampleOutput,
        model: "gpt-4o-mini",
        promptVersion: "rental-ad-assistant-v1",
        lastGeneratedAt: new Date("2026-06-04T12:00:00.000Z"),
      },
    );

    assert.deepEqual(updated.outputJson, sampleOutput);
    assert.equal(updated.model, "gpt-4o-mini");
    assert.equal(state.propertyUpdates.length, 0);
    assert.equal(state.unitUpdates.length, 0);
    assert.equal(state.tenancyUpdates.length, 0);
  });

  it("requires an existing draft before saving output", async () => {
    const prisma = createMockPrisma({ drafts: [], propertyUpdates: [], unitUpdates: [], tenancyUpdates: [] });

    await assert.rejects(
      () =>
        saveRentalAdAssistantDraftOutput(
          prisma as unknown as PrismaClient,
          pmContext(),
          UNIT_ID,
          { output: sampleOutput },
        ),
      (err: unknown) => err instanceof NotFoundError,
    );
  });

  it("clears generated output while keeping saved inputs", async () => {
    const state: MockState = {
      drafts: [
        draftRow({
          outputJson: sampleOutput,
          compsSnapshotJson: { label: "Historical lease rents", count: 0 },
          model: "gpt-4o-mini",
          promptVersion: "rental-ad-assistant-v1",
          lastGeneratedAt: new Date("2026-06-04T12:00:00.000Z"),
        }),
      ],
      propertyUpdates: [],
      unitUpdates: [],
      tenancyUpdates: [],
    };
    const prisma = createMockPrisma(state);

    const cleared = await clearRentalAdAssistantDraftOutput(
      prisma as unknown as PrismaClient,
      pmContext(),
      UNIT_ID,
    );

    assert.deepEqual(cleared.inputsJson, sampleInputs);
    assert.equal(cleared.outputJson, null);
    assert.equal(cleared.compsSnapshotJson, null);
    assert.equal(cleared.model, null);
    assert.equal(cleared.promptVersion, null);
    assert.equal(cleared.lastGeneratedAt, null);
  });
});
