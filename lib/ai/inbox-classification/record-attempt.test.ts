import assert from "node:assert/strict";
import { describe, it } from "node:test";
import prisma from "@/lib/db/prisma";
import { recordInboxClassificationAttempt } from "./record-attempt";

type UpdateManyCall = {
  where: unknown;
  data: unknown;
};

describe("recordInboxClassificationAttempt", () => {
  it("writes attempts for UNCATEGORIZED threads with null categorySource", async () => {
    const calls: UpdateManyCall[] = [];
    const original = prisma.emailThread.updateMany;

    prisma.emailThread.updateMany = (async (args: UpdateManyCall) => {
      calls.push(args);
      return { count: 1 };
    }) as typeof prisma.emailThread.updateMany;

    try {
      await recordInboxClassificationAttempt({
        threadId: "thread_1",
        organizationId: "org_1",
        confidence: 0.42,
        reason: "Likely tenant inquiry but uncertain.",
      });
    } finally {
      prisma.emailThread.updateMany = original;
    }

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.where, {
      id: "thread_1",
      organizationId: "org_1",
      category: "UNCATEGORIZED",
      OR: [{ categorySource: null }, { categorySource: { not: "manual" } }],
      NOT: {
        categoryAssignments: {
          some: { source: "MANUAL" },
        },
      },
      AND: [
        {
          NOT: {
            categoryAssignments: {
              some: {
                category: { not: "UNCATEGORIZED" },
              },
            },
          },
        },
      ],
    });
    assert.equal(
      (calls[0]?.data as { categoryAiReason?: string }).categoryAiReason,
      "Likely tenant inquiry but uncertain.",
    );
  });
});
