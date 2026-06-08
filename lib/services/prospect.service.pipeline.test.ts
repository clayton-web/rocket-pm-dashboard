import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { markApplicationSent, markProspectQualified } from "./prospect.service";

const PROSPECT_ID = "prospect_test";
const PROPERTY_ID = "property_test";
const ORG_ID = "org_test";
const USER_ID = "user_test";

const ctx = {
  userId: USER_ID,
  organizationId: ORG_ID,
  organizationRole: "ADMIN" as const,
  primaryRoleKey: "property_manager" as const,
  assignmentRolesByProperty: new Map<string, ReadonlySet<"property_manager">>(),
};

const activeProspect = {
  id: PROSPECT_ID,
  propertyId: PROPERTY_ID,
  status: "new" as const,
  qualifiedAt: null,
  applicationSentAt: null,
  unitId: null,
};

type MockProspectStore = typeof activeProspect & {
  qualifiedAt: Date | null;
  applicationSentAt: Date | null;
};

function createMockPrisma(store: { prospect: MockProspectStore }) {
  return {
    prospect: {
      findUnique: async () => store.prospect,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(store.prospect, data);
        return { ...store.prospect };
      },
    },
    property: {
      findFirst: async () => ({ id: PROPERTY_ID, organizationId: ORG_ID }),
    },
    activityLog: {
      create: async () => ({ id: "log_1" }),
    },
  } as unknown as PrismaClient;
}

describe("markProspectQualified", () => {
  it("sets qualifiedAt for an active prospect", async () => {
    const store = { prospect: { ...activeProspect } };
    const prisma = createMockPrisma(store);

    const row = await markProspectQualified(prisma, ctx, PROSPECT_ID);
    assert.ok(row.qualifiedAt instanceof Date);
  });
});

describe("markApplicationSent", () => {
  it("sets applicationSentAt for an active prospect", async () => {
    const store = { prospect: { ...activeProspect } };
    const prisma = createMockPrisma(store);

    const row = await markApplicationSent(prisma, ctx, PROSPECT_ID);
    assert.ok(row.applicationSentAt instanceof Date);
  });
});
