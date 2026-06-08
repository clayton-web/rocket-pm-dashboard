import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import {
  resolveCategoryForNewSyncedThread,
  upsertSenderCategoryMemory,
  upsertSenderCategoryMemoryFromThread,
} from "./sender-category-memory";

const ORG_ID = "org_test";
const MAILBOX_ID = "mailbox_test";
const THREAD_ID = "thread_test";
const USER_ID = "user_test";

type MockPrisma = {
  emailThread: {
    findFirst: () => Promise<{
      organizationId: string;
      connectedAccountId: string;
      messages: { fromAddr: string; isOutbound: boolean; sentAt: Date }[];
    } | null>;
  };
  emailSenderCategoryMemory: {
    upsert: (input: unknown) => Promise<unknown>;
    findUnique: () => Promise<{
      id: string;
      organizationId: string;
      connectedAccountId: string;
      senderEmail: string;
      senderName: string | null;
      category: "STRATA";
      contextNote: string | null;
      source: string;
      createdByUserId: string | null;
      lastMatchedAt: Date | null;
      matchCount: number;
      createdAt: Date;
      updatedAt: Date;
    } | null>;
    update: (input: unknown) => Promise<{ id: string }>;
  };
};

function withMockPrisma<T>(mock: MockPrisma, run: () => Promise<T>): Promise<T> {
  const originalThread = prisma.emailThread;
  const originalMemory = prisma.emailSenderCategoryMemory;

  Object.assign(prisma, {
    emailThread: mock.emailThread,
    emailSenderCategoryMemory: mock.emailSenderCategoryMemory,
  });

  return run().finally(() => {
    Object.assign(prisma, {
      emailThread: originalThread,
      emailSenderCategoryMemory: originalMemory,
    });
  });
}

describe("upsertSenderCategoryMemoryFromThread", () => {
  it("upserts sender memory from the latest inbound sender on manual category change", async () => {
    const upsertCalls: unknown[] = [];

    await withMockPrisma(
      {
        emailThread: {
          findFirst: async () => ({
            organizationId: ORG_ID,
            connectedAccountId: MAILBOX_ID,
            connectedAccount: { email: "manager@pm.com" },
            messages: [
              {
                fromAddr: "manager@pm.com",
                isOutbound: true,
                sentAt: new Date("2026-06-10T12:00:00.000Z"),
              },
              {
                fromAddr: "Tenant@Example.com",
                isOutbound: false,
                sentAt: new Date("2026-06-10T11:00:00.000Z"),
              },
            ],
          }),
        },
        emailSenderCategoryMemory: {
          upsert: async (input) => {
            upsertCalls.push(input);
            return { id: "memory_1" };
          },
          findUnique: async () => null,
          update: async () => ({ id: "memory_1" }),
        },
      },
      async () => {
        const result = await upsertSenderCategoryMemoryFromThread({
          threadId: THREAD_ID,
          category: "TENANT_COMMUNICATION",
          userId: USER_ID,
        });

        assert.deepEqual(result, { ok: true, senderEmail: "tenant@example.com" });
        assert.equal(upsertCalls.length, 1);
        assert.deepEqual((upsertCalls[0] as { create: Record<string, unknown> }).create, {
          organizationId: ORG_ID,
          connectedAccountId: MAILBOX_ID,
          senderEmail: "tenant@example.com",
          senderName: null,
          category: "TENANT_COMMUNICATION",
          contextNote: null,
          source: "manual",
          createdByUserId: USER_ID,
        });
      },
    );
  });

  it("skips sender memory when latest inbound sender is the connected mailbox", async () => {
    const upsertCalls: unknown[] = [];

    await withMockPrisma(
      {
        emailThread: {
          findFirst: async () => ({
            organizationId: ORG_ID,
            connectedAccountId: MAILBOX_ID,
            connectedAccount: { email: "Manager@PM.com" },
            messages: [
              {
                fromAddr: "Manager@PM.com",
                isOutbound: false,
                sentAt: new Date("2026-06-10T11:00:00.000Z"),
              },
            ],
          }),
        },
        emailSenderCategoryMemory: {
          upsert: async (input) => {
            upsertCalls.push(input);
            return { id: "memory_1" };
          },
          findUnique: async () => null,
          update: async () => ({ id: "memory_1" }),
        },
      },
      async () => {
        const result = await upsertSenderCategoryMemoryFromThread({
          threadId: THREAD_ID,
          category: "LANDLORD_COMMUNICATION",
          userId: USER_ID,
        });

        assert.deepEqual(result, { ok: true, senderEmail: null });
        assert.equal(upsertCalls.length, 0);
      },
    );
  });
});

describe("resolveCategoryForNewSyncedThread", () => {
  it("applies remembered sender category for new synced threads", async () => {
    const memoryUpdates: unknown[] = [];

    const tx = {
      emailSenderCategoryMemory: {
        findUnique: async () => ({
          id: "memory_1",
          organizationId: ORG_ID,
          connectedAccountId: MAILBOX_ID,
          senderEmail: "strata@building.com",
          senderName: null,
          category: "STRATA" as const,
          contextNote: null,
          source: "manual",
          createdByUserId: USER_ID,
          lastMatchedAt: null,
          matchCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: async (input: unknown) => {
          memoryUpdates.push(input);
          return { id: "memory_1" };
        },
      },
    } as unknown as Prisma.TransactionClient;

    const resolved = await resolveCategoryForNewSyncedThread(tx, {
      organizationId: ORG_ID,
      connectedAccountId: MAILBOX_ID,
      messages: [
        {
          providerMessageId: "msg_1",
          fromAddr: "strata@building.com",
          toAddrs: ["manager@pm.com"],
          ccAddrs: [],
          sentAt: new Date("2026-06-10T10:00:00.000Z"),
          bodyText: "Minutes attached",
          bodyHtml: null,
          labelIds: [],
          isOutbound: false,
          isUnread: true,
        },
      ],
    });

    assert.equal(resolved?.category, "STRATA");
    assert.equal(resolved?.categorySource, "rule");
    assert.ok(resolved?.categoryUpdatedAt instanceof Date);
    assert.equal(memoryUpdates.length, 1);
    assert.deepEqual((memoryUpdates[0] as { data: Record<string, unknown> }).data, {
      lastMatchedAt: (memoryUpdates[0] as { data: { lastMatchedAt: Date } }).data.lastMatchedAt,
      matchCount: { increment: 1 },
    });
  });

  it("returns null when sender memory is missing", async () => {
    const tx = {
      emailSenderCategoryMemory: {
        findUnique: async () => null,
        update: async () => {
          throw new Error("should not update");
        },
      },
    } as unknown as Prisma.TransactionClient;

    const resolved = await resolveCategoryForNewSyncedThread(tx, {
      organizationId: ORG_ID,
      connectedAccountId: MAILBOX_ID,
      messages: [
        {
          providerMessageId: "msg_1",
          fromAddr: "new@sender.com",
          toAddrs: [],
          ccAddrs: [],
          sentAt: new Date("2026-06-10T10:00:00.000Z"),
          bodyText: null,
          bodyHtml: null,
          labelIds: [],
          isOutbound: false,
          isUnread: true,
        },
      ],
    });

    assert.equal(resolved, null);
  });
});

describe("upsertSenderCategoryMemory", () => {
  it("uses org + mailbox + senderEmail unique key", async () => {
    const upsertCalls: unknown[] = [];

    await withMockPrisma(
      {
        emailThread: {
          findFirst: async () => null,
        },
        emailSenderCategoryMemory: {
          upsert: async (input) => {
            upsertCalls.push(input);
            return { id: "memory_1" };
          },
          findUnique: async () => null,
          update: async () => ({ id: "memory_1" }),
        },
      },
      async () => {
        await upsertSenderCategoryMemory({
          organizationId: ORG_ID,
          connectedAccountId: MAILBOX_ID,
          senderEmail: "landlord@example.com",
          category: "LANDLORD_COMMUNICATION",
          source: "manual",
          createdByUserId: USER_ID,
        });

        assert.deepEqual(
          (upsertCalls[0] as { where: Record<string, unknown> }).where,
          {
            organizationId_connectedAccountId_senderEmail: {
              organizationId: ORG_ID,
              connectedAccountId: MAILBOX_ID,
              senderEmail: "landlord@example.com",
            },
          },
        );
      },
    );
  });
});
