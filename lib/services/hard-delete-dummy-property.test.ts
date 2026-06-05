import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import {
  PROPERTY_HARD_DELETE_BLOCKED_MESSAGE,
  PropertyHardDeleteBlockedError,
  hardDeleteDummyProperty,
  listPropertyHardDeleteBlockers,
} from "./hard-delete-dummy-property";
import type { StaffContext } from "./staff-context";

const ORG_ID = "org_test";
const OTHER_ORG_ID = "org_other";
const PROPERTY_ID = "prop_test";

type CountMap = Partial<Record<string, number>>;

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

function createMockPrisma(args: {
  organizationId?: string;
  counts?: CountMap;
  deleteThrows?: unknown;
}) {
  const counts = args.counts ?? {};
  const deletedPropertyIds: string[] = [];

  const countFor = (model: string) => counts[model] ?? 0;

  const prisma = {
    property: {
      findFirst: async () =>
        args.organizationId === undefined
          ? null
          : {
              id: PROPERTY_ID,
              organizationId: args.organizationId,
            },
      delete: async ({ where }: { where: { id: string } }) => {
        if (args.deleteThrows) throw args.deleteThrows;
        deletedPropertyIds.push(where.id);
        return { id: where.id };
      },
    },
    tenancy: { count: async () => countFor("tenancy") },
    application: { count: async () => countFor("application") },
    prospect: { count: async () => countFor("prospect") },
    showing: { count: async () => countFor("showing") },
    signatureRequest: { count: async () => countFor("signatureRequest") },
    leaseSignature: { count: async () => countFor("leaseSignature") },
    document: { count: async () => countFor("document") },
    applicationDocument: { count: async () => countFor("applicationDocument") },
    notice: { count: async () => countFor("notice") },
    maintenanceRequest: { count: async () => countFor("maintenanceRequest") },
    checklist: { count: async () => countFor("checklist") },
    userPropertyAssignment: {
      findFirst: async () => ({ id: "assign_1" }),
    },
    $transaction: async <T>(fn: (tx: PrismaClient) => Promise<T>) => fn(prisma as unknown as PrismaClient),
    get deletedPropertyIds() {
      return deletedPropertyIds;
    },
  };

  return prisma;
}

describe("listPropertyHardDeleteBlockers", () => {
  it("returns no blockers for dummy property with only units", async () => {
    const prisma = createMockPrisma({ organizationId: ORG_ID });
    const blockers = await listPropertyHardDeleteBlockers(prisma as unknown as PrismaClient, PROPERTY_ID);
    assert.deepEqual(blockers, []);
  });

  it("blocks when tenancy exists", async () => {
    const prisma = createMockPrisma({ organizationId: ORG_ID, counts: { tenancy: 1 } });
    const blockers = await listPropertyHardDeleteBlockers(prisma as unknown as PrismaClient, PROPERTY_ID);
    assert.ok(blockers.includes("tenancy"));
  });

  it("blocks when application exists", async () => {
    const prisma = createMockPrisma({ organizationId: ORG_ID, counts: { application: 1 } });
    const blockers = await listPropertyHardDeleteBlockers(prisma as unknown as PrismaClient, PROPERTY_ID);
    assert.ok(blockers.includes("application"));
  });

  it("blocks when prospect or showing exists", async () => {
    const prospectPrisma = createMockPrisma({ organizationId: ORG_ID, counts: { prospect: 2 } });
    const showingPrisma = createMockPrisma({ organizationId: ORG_ID, counts: { showing: 1 } });
    assert.ok(
      (await listPropertyHardDeleteBlockers(prospectPrisma as unknown as PrismaClient, PROPERTY_ID)).includes(
        "prospect",
      ),
    );
    assert.ok(
      (await listPropertyHardDeleteBlockers(showingPrisma as unknown as PrismaClient, PROPERTY_ID)).includes(
        "showing",
      ),
    );
  });

  it("blocks when document, signature, notice, maintenance, or checklist exists", async () => {
    for (const model of [
      "document",
      "signatureRequest",
      "leaseSignature",
      "applicationDocument",
      "notice",
      "maintenanceRequest",
      "checklist",
    ] as const) {
      const prisma = createMockPrisma({ organizationId: ORG_ID, counts: { [model]: 1 } });
      const blockers = await listPropertyHardDeleteBlockers(prisma as unknown as PrismaClient, PROPERTY_ID);
      assert.ok(blockers.includes(model), `expected blocker for ${model}`);
    }
  });
});

describe("hardDeleteDummyProperty", () => {
  it("hard delete succeeds for dummy property with only units", async () => {
    const prisma = createMockPrisma({ organizationId: ORG_ID });
    await hardDeleteDummyProperty(prisma as unknown as PrismaClient, adminContext(), PROPERTY_ID);
    assert.deepEqual(prisma.deletedPropertyIds, [PROPERTY_ID]);
  });

  it("blocks when protected records exist and does not delete", async () => {
    const prisma = createMockPrisma({ organizationId: ORG_ID, counts: { tenancy: 1 } });
    await assert.rejects(
      () => hardDeleteDummyProperty(prisma as unknown as PrismaClient, adminContext(), PROPERTY_ID),
      (error: unknown) => {
        assert.ok(error instanceof PropertyHardDeleteBlockedError);
        assert.equal(error.message, PROPERTY_HARD_DELETE_BLOCKED_MESSAGE);
        assert.ok(error.blockers.includes("tenancy"));
        return true;
      },
    );
    assert.deepEqual(prisma.deletedPropertyIds, []);
  });

  it("denies field agents", async () => {
    const prisma = createMockPrisma({ organizationId: ORG_ID });
    await assert.rejects(
      () => hardDeleteDummyProperty(prisma as unknown as PrismaClient, fieldAgentContext(), PROPERTY_ID),
      ForbiddenError,
    );
    assert.deepEqual(prisma.deletedPropertyIds, []);
  });

  it("denies unrelated organization", async () => {
    const prisma = createMockPrisma({ organizationId: OTHER_ORG_ID });
    await assert.rejects(
      () => hardDeleteDummyProperty(prisma as unknown as PrismaClient, adminContext(), PROPERTY_ID),
      ForbiddenError,
    );
    assert.deepEqual(prisma.deletedPropertyIds, []);
  });

  it("returns blocked message on foreign key constraint errors", async () => {
    const prisma = createMockPrisma({
      organizationId: ORG_ID,
      deleteThrows: new Prisma.PrismaClientKnownRequestError("FK constraint", {
        code: "P2003",
        clientVersion: "test",
      }),
    });
    await assert.rejects(
      () => hardDeleteDummyProperty(prisma as unknown as PrismaClient, adminContext(), PROPERTY_ID),
      PropertyHardDeleteBlockedError,
    );
  });

  it("throws not found when property is missing", async () => {
    const prisma = createMockPrisma({ organizationId: undefined });
    await assert.rejects(
      () => hardDeleteDummyProperty(prisma as unknown as PrismaClient, adminContext(), PROPERTY_ID),
      NotFoundError,
    );
  });
});

describe("hard delete property action confirmation", () => {
  it("requires DELETE confirmation text in the server action module", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../../app/(dashboard)/properties/actions.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /PROPERTY_HARD_DELETE_CONFIRMATION_TEXT/);
    assert.match(source, /hardDeleteDummyProperty/);
    assert.match(source, /Type DELETE to confirm/);
  });
});

describe("hard delete property UI", () => {
  it("includes destructive delete section on property detail", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../../components/properties/property-detail.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /Delete Property/);
    assert.match(source, /permanently deletes this property/);
    assert.match(source, /hardDeletePropertyAction/);
  });
});
