import assert from "node:assert/strict";
import { describe, it } from "node:test";
import prisma from "@/lib/db/prisma";
import { classifyInboxThread } from "./classify-thread";

const ORG_ID = "org_test";
const THREAD_ID = "thread_test";

const baseThread = {
  id: THREAD_ID,
  organizationId: ORG_ID,
  connectedAccountId: "mailbox_test",
  subject: "Lease question",
  snippet: "Can I see the unit this week?",
  participantEmails: ["tenant@example.com"],
  contextLinks: [],
  category: "UNCATEGORIZED" as const,
  categorySource: null,
  lastClassificationAttemptAt: null,
  messages: [
    {
      fromAddr: "tenant@example.com",
      isOutbound: false,
      sentAt: new Date("2026-06-10T12:00:00.000Z"),
      bodyText: "Can I see the unit this week?",
    },
  ],
};

type UpdateManyCall = {
  where: unknown;
  data: unknown;
};

function withMockPrisma<T>(
  mocks: {
    findFirst: () => Promise<typeof baseThread | null>;
    updateMany?: (args: UpdateManyCall) => Promise<{ count: number }>;
    senderMemoryFindUnique?: () => Promise<null>;
  },
  run: () => Promise<T>,
): Promise<T> {
  const originalThread = prisma.emailThread;
  const originalMemory = prisma.emailSenderCategoryMemory;

  Object.assign(prisma, {
    emailThread: {
      findFirst: mocks.findFirst,
      updateMany:
        mocks.updateMany ??
        (async () => ({ count: 0 })),
    },
    emailSenderCategoryMemory: {
      findUnique: mocks.senderMemoryFindUnique ?? (async () => null),
    },
  });

  return run().finally(() => {
    Object.assign(prisma, {
      emailThread: originalThread,
      emailSenderCategoryMemory: originalMemory,
    });
  });
}

describe("classifyInboxThread", () => {
  it("applies STRATA deterministic rules without calling Gemini", async () => {
    let geminiCalled = false;
    const updateCalls: UpdateManyCall[] = [];

    const result = await withMockPrisma(
      {
        findFirst: async () => ({
          ...baseThread,
          subject: "Fwd: LMS2505R - Building Notice - Dryer Vent Cleaning",
          messages: [
            {
              fromAddr: "communications@mc.fsresidential.com",
              isOutbound: false,
              sentAt: new Date("2026-06-10T12:00:00.000Z"),
              bodyText: "Please forward to tenants.",
            },
          ],
        }),
        updateMany: async (args) => {
          updateCalls.push(args);
          return { count: 1 };
        },
      },
      () =>
        classifyInboxThread({
          threadId: THREAD_ID,
          organizationId: ORG_ID,
          createCompletion: async () => {
            geminiCalled = true;
            return { category: "TENANT_INQUIRY", confidence: 1, reason: "should not run" };
          },
        }),
    );

    assert.equal(geminiCalled, false);
    assert.equal(result.status, "classified");
    if (result.status === "classified") {
      assert.equal(result.category, "STRATA");
    }
    assert.equal((updateCalls[0]?.data as { categorySource?: string }).categorySource, "rule");
  });

  it("returns rate_limited without recording an attempt", async () => {
    const updateCalls: UpdateManyCall[] = [];

    const result = await withMockPrisma(
      {
        findFirst: async () => baseThread,
        updateMany: async (args) => {
          updateCalls.push(args);
          return { count: 1 };
        },
      },
      () =>
        classifyInboxThread({
          threadId: THREAD_ID,
          organizationId: ORG_ID,
          createCompletion: async () => {
            throw new Error(
              'Gemini request failed: {"error":{"code":429,"message":"quota exceeded","status":"RESOURCE_EXHAUSTED"}}',
            );
          },
        }),
    );

    assert.equal(result.status, "rate_limited");
    assert.equal(updateCalls.length, 0);
  });

  it("records low-confidence attempts for null categorySource threads", async () => {
    const updateCalls: UpdateManyCall[] = [];

    const result = await withMockPrisma(
      {
        findFirst: async () => baseThread,
        updateMany: async (args) => {
          updateCalls.push(args);
          return { count: 1 };
        },
      },
      () =>
        classifyInboxThread({
          threadId: THREAD_ID,
          organizationId: ORG_ID,
          createCompletion: async () => ({
            category: "TENANT_INQUIRY",
            confidence: 0.55,
            reason: "Prospective renter asking about a showing.",
          }),
        }),
    );

    assert.equal(result.status, "low_confidence");
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(updateCalls[0]?.where, {
      id: THREAD_ID,
      organizationId: ORG_ID,
      category: "UNCATEGORIZED",
      OR: [{ categorySource: null }, { categorySource: { not: "manual" } }],
    });
    assert.equal(
      (updateCalls[0]?.data as { categoryAiReason?: string }).categoryAiReason,
      "Prospective renter asking about a showing.",
    );
  });

  it("skips sales-offer threads deterministically without calling Gemini", async () => {
    let geminiCalled = false;

    const result = await withMockPrisma(
      {
        findFirst: async () => ({
          ...baseThread,
          subject: "Clark Van Alstyne has viewed 213th Offer",
          messages: [
            {
              fromAddr: "noreply@mail.hellosign.com",
              isOutbound: false,
              sentAt: new Date("2026-06-10T12:00:00.000Z"),
              bodyText: null,
            },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      () =>
        classifyInboxThread({
          threadId: THREAD_ID,
          organizationId: ORG_ID,
          createCompletion: async () => {
            geminiCalled = true;
            return { category: "TENANT_INQUIRY", confidence: 1, reason: "should not run" };
          },
        }),
    );

    assert.equal(geminiCalled, false);
    assert.equal(result.status, "skipped");
    assert.equal(result.status === "skipped" ? result.reason : "", "deterministic_uncategorized");
  });

  it("skips manual threads before deterministic rules or Gemini", async () => {
    let geminiCalled = false;

    const result = await withMockPrisma(
      {
        findFirst: async () => ({
          ...baseThread,
          categorySource: "manual",
          category: "STRATA",
          subject: "Fwd: LMS2505R - Building Notice",
        }),
        updateMany: async () => ({ count: 0 }),
      },
      () =>
        classifyInboxThread({
          threadId: THREAD_ID,
          organizationId: ORG_ID,
          createCompletion: async () => {
            geminiCalled = true;
            return { category: "STRATA", confidence: 1, reason: "should not run" };
          },
        }),
    );

    assert.equal(geminiCalled, false);
    assert.equal(result.status, "skipped");
    assert.equal(result.status === "skipped" ? result.reason : "", "not_eligible");
  });
});
