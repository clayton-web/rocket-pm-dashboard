import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createShowing } from "./showing.service";

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

describe("createShowing auto-qualifies prospect", () => {
  it("sets qualifiedAt once and writes one prospect.qualified audit", async () => {
    const prospect = {
      id: PROSPECT_ID,
      propertyId: PROPERTY_ID,
      status: "new" as const,
      qualifiedAt: null as Date | null,
      applicationSentAt: null,
      unitId: null,
    };
    const audits: string[] = [];
    let showingId = 0;

    const prisma = {
      prospect: {
        findUnique: async () => ({ ...prospect }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(prospect, data);
          return { ...prospect };
        },
      },
      property: {
        findFirst: async () => ({ id: PROPERTY_ID, organizationId: ORG_ID }),
      },
      unit: {
        findUnique: async () => null,
      },
      showing: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          showingId += 1;
          return {
            id: `showing_${showingId}`,
            ...data,
          };
        },
      },
      activityLog: {
        create: async ({ data }: { data: { action: string } }) => {
          audits.push(data.action);
          return { id: `log_${audits.length}` };
        },
      },
      organizationMembership: {
        findFirst: async () => ({ id: "mem_1" }),
      },
    } as unknown as PrismaClient;

    await createShowing(prisma, ctx, {
      prospectId: PROSPECT_ID,
      propertyId: PROPERTY_ID,
      scheduledStart: new Date("2026-07-15T18:00:00.000Z"),
    });

    assert.ok(prospect.qualifiedAt instanceof Date);
    assert.equal(audits.filter((a) => a === "prospect.qualified").length, 1);
    assert.equal(audits.filter((a) => a === "showing.created").length, 1);

    await createShowing(prisma, ctx, {
      prospectId: PROSPECT_ID,
      propertyId: PROPERTY_ID,
      scheduledStart: new Date("2026-07-16T18:00:00.000Z"),
    });

    assert.equal(audits.filter((a) => a === "prospect.qualified").length, 1);
    assert.equal(audits.filter((a) => a === "showing.created").length, 2);
  });
});
