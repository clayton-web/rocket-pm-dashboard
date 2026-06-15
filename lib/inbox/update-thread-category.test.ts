import assert from "node:assert/strict";
import { describe, it } from "node:test";
import prisma from "@/lib/db/prisma";
import { updateEmailThreadCategory } from "./update-thread-category";

const THREAD_ID = "thread_test";
const ORG_ID = "org_test";

describe("update-thread-category", () => {
  it("replaces assignments when manually reclassifying", async () => {
    let manualReplaceCalled = false;

    const originalFindFirst = prisma.emailThread.findFirst;
    const originalTransaction = prisma.$transaction;
    const originalUpdate = prisma.emailThread.update;

    prisma.emailThread.findFirst = (async () => ({ id: THREAD_ID })) as typeof originalFindFirst;
    prisma.$transaction = (async (callback) => {
      manualReplaceCalled = true;
      return callback({
        emailThreadCategoryAssignment: {
          deleteMany: async () => ({ count: 1 }),
          create: async () => ({ id: "assignment_1" }),
          findMany: async () => [{ category: "STRATA", source: "MANUAL", reason: null, assignedAt: new Date() }],
        },
        emailThread: {
          update: async () => ({ id: THREAD_ID }),
        },
      });
    }) as typeof originalTransaction;
    prisma.emailThread.update = originalUpdate;

    try {
      const result = await updateEmailThreadCategory({
        threadId: THREAD_ID,
        organizationId: ORG_ID,
        category: "STRATA",
        categorySource: "manual",
      });

      assert.equal(result.ok, true);
      assert.equal(manualReplaceCalled, true);
    } finally {
      prisma.emailThread.findFirst = originalFindFirst;
      prisma.$transaction = originalTransaction;
      prisma.emailThread.update = originalUpdate;
    }
  });
});
