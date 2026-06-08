import assert from "node:assert/strict";
import { describe, it } from "node:test";
import prisma from "@/lib/db/prisma";
import { updateEmailThreadCategory } from "./update-thread-category";

const THREAD_ID = "thread_test";
const ORG_ID = "org_test";

type UpdateCall = {
  where: { id: string };
  data: Record<string, unknown>;
};

describe("update-thread-category", () => {
  it("clears classification metadata when category is set manually", async () => {
    const updates: UpdateCall[] = [];

    const originalFindFirst = prisma.emailThread.findFirst;
    const originalUpdate = prisma.emailThread.update;

    prisma.emailThread.findFirst = (async () => ({ id: THREAD_ID })) as typeof originalFindFirst;
    prisma.emailThread.update = (async (args: UpdateCall) => {
      updates.push(args);
      return { id: THREAD_ID };
    }) as typeof originalUpdate;

    try {
      const result = await updateEmailThreadCategory({
        threadId: THREAD_ID,
        organizationId: ORG_ID,
        category: "STRATA",
        categorySource: "manual",
      });

      assert.equal(result.ok, true);
      assert.equal(updates.length, 1);
      assert.equal(updates[0]?.data.category, "STRATA");
      assert.equal(updates[0]?.data.categorySource, "manual");
      assert.equal(updates[0]?.data.categoryConfidence, null);
      assert.equal(updates[0]?.data.categoryAiReason, null);
      assert.equal(updates[0]?.data.lastClassificationAttemptAt, null);
    } finally {
      prisma.emailThread.findFirst = originalFindFirst;
      prisma.emailThread.update = originalUpdate;
    }
  });

  it("does not clear classification metadata for non-manual updates", async () => {
    const updates: UpdateCall[] = [];

    const originalFindFirst = prisma.emailThread.findFirst;
    const originalUpdate = prisma.emailThread.update;

    prisma.emailThread.findFirst = (async () => ({ id: THREAD_ID })) as typeof originalFindFirst;
    prisma.emailThread.update = (async (args: UpdateCall) => {
      updates.push(args);
      return { id: THREAD_ID };
    }) as typeof originalUpdate;

    try {
      const result = await updateEmailThreadCategory({
        threadId: THREAD_ID,
        organizationId: ORG_ID,
        category: "STRATA",
        categorySource: "ai",
      });

      assert.equal(result.ok, true);
      assert.equal(updates[0]?.data.categoryConfidence, undefined);
      assert.equal(updates[0]?.data.categoryAiReason, undefined);
      assert.equal(updates[0]?.data.lastClassificationAttemptAt, undefined);
    } finally {
      prisma.emailThread.findFirst = originalFindFirst;
      prisma.emailThread.update = originalUpdate;
    }
  });
});
