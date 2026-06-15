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
  categoryAssignments: [] as Array<{
    category: "UNCATEGORIZED";
    source: "RULE";
    reason: string | null;
    assignedAt: Date;
  }>,
  messages: [
    {
      fromAddr: "tenant@example.com",
      isOutbound: false,
      sentAt: new Date("2026-06-10T12:00:00.000Z"),
      bodyText: "Can I see the unit this week?",
    },
  ],
};

type TransactionCall = {
  callback: (tx: {
    emailThreadCategoryAssignment: {
      findMany: () => Promise<typeof baseThread.categoryAssignments>;
      deleteMany: () => Promise<{ count: number }>;
      create: () => Promise<{ id: string }>;
    };
    emailThread: {
      update: () => Promise<{ id: string }>;
    };
  }) => Promise<unknown>;
};

function withMockPrisma<T>(
  mocks: {
    findFirst: () => Promise<typeof baseThread | null>;
    transaction?: (call: TransactionCall) => Promise<unknown>;
    propertyFindFirst?: () => Promise<{ id: string; name: string } | null>;
    tenancyContactFindFirst?: () => Promise<{ firstName: string; lastName: string } | null>;
    updateMany?: (args: unknown) => Promise<{ count: number }>;
  },
  run: () => Promise<T>,
): Promise<T> {
  const originalThread = prisma.emailThread;
  const originalProperty = prisma.property;
  const originalContact = prisma.tenancyContact;
  const originalTransaction = prisma.$transaction;

  Object.assign(prisma, {
    emailThread: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany ?? (async () => ({ count: 1 })),
    },
    property: {
      findFirst: mocks.propertyFindFirst ?? (async () => null),
    },
    tenancyContact: {
      findFirst: mocks.tenancyContactFindFirst ?? (async () => null),
    },
    $transaction:
      mocks.transaction ??
      (async (callback: TransactionCall["callback"]) =>
        callback({
          emailThreadCategoryAssignment: {
            findMany: async () => [],
            deleteMany: async () => ({ count: 0 }),
            create: async () => ({ id: "assignment_1" }),
          },
          emailThread: {
            update: async () => ({ id: THREAD_ID }),
          },
        })),
  });

  return run().finally(() => {
    Object.assign(prisma, {
      emailThread: originalThread,
      property: originalProperty,
      tenancyContact: originalContact,
      $transaction: originalTransaction,
    });
  });
}

describe("classifyInboxThread", () => {
  it("applies STRATA deterministic rules without calling Gemini", async () => {
    let geminiCalled = false;

    const result = await withMockPrisma(
      {
        findFirst: async () => ({
          ...baseThread,
          subject: "Fwd: LMS2505R - Building Notice - Dryer Vent Cleaning",
          messages: [
            {
              fromAddr: "owner@example.com",
              isOutbound: false,
              sentAt: new Date("2026-06-10T12:00:00.000Z"),
              bodyText: "Please forward to tenants.",
            },
          ],
        }),
        transaction: async (callback) =>
          callback({
            emailThreadCategoryAssignment: {
              findMany: async () => [],
              deleteMany: async () => ({ count: 0 }),
              create: async () => ({ id: "assignment_1" }),
            },
            emailThread: {
              update: async () => ({ id: THREAD_ID }),
            },
          }).then(() => ({ count: 1, assignments: [{ category: "STRATA", source: "RULE", reason: "Matched", assignedAt: new Date() }] })),
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
      assert.deepEqual(result.categories, ["STRATA"]);
    }
  });

  it("falls back to Gemini only when no deterministic match exists", async () => {
    let geminiCalled = false;

    const result = await withMockPrisma(
      {
        findFirst: async () => baseThread,
        transaction: async (callback) =>
          callback({
            emailThreadCategoryAssignment: {
              findMany: async () => [],
              deleteMany: async () => ({ count: 0 }),
              create: async () => ({ id: "assignment_1" }),
            },
            emailThread: {
              update: async () => ({ id: THREAD_ID }),
            },
          }).then(() => ({
            count: 1,
            assignments: [{ category: "TENANT_INQUIRY", source: "AI", reason: "Lead", assignedAt: new Date() }],
          })),
      },
      () =>
        classifyInboxThread({
          threadId: THREAD_ID,
          organizationId: ORG_ID,
          createCompletion: async () => {
            geminiCalled = true;
            return {
              category: "TENANT_INQUIRY",
              confidence: 0.9,
              reason: "Prospective renter asking about a showing.",
            };
          },
        }),
    );

    assert.equal(geminiCalled, true);
    assert.equal(result.status, "classified");
    if (result.status === "classified") {
      assert.deepEqual(result.categories, ["TENANT_INQUIRY"]);
    }
  });

  it("returns rate_limited without recording an attempt", async () => {
    const updateCalls: unknown[] = [];

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
    const updateCalls: unknown[] = [];

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
  });

  it("skips manual threads before deterministic rules or Gemini", async () => {
    let geminiCalled = false;

    const result = await withMockPrisma(
      {
        findFirst: async () => ({
          ...baseThread,
          categorySource: "manual",
          category: "STRATA",
          categoryAssignments: [
            {
              category: "STRATA",
              source: "MANUAL",
              reason: null,
              assignedAt: new Date("2026-06-10T12:00:00.000Z"),
            },
          ],
          subject: "Fwd: LMS2505R - Building Notice",
        }),
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
