import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingAttentionStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { loadActiveAttentionRows } from "@/lib/briefing/sources/email/active-email-items/load-active-attention";

describe("loadActiveAttentionRows", () => {
  it("queries ACTIVE rows scoped to organizationId", async () => {
    const calls: unknown[] = [];
    const rows = [
      {
        id: "attn_1",
        organizationId: "org_1",
        emailThreadId: "thread_1",
        status: BriefingAttentionStatus.ACTIVE,
      },
    ];

    const result = await loadActiveAttentionRows(
      { organizationId: "org_1" },
      {
        findMany: async (args) => {
          calls.push(args);
          return rows as Awaited<ReturnType<typeof loadActiveAttentionRows>>;
        },
      },
    );

    assert.deepEqual(result, rows);
    assert.equal(calls.length, 1);
    const query = calls[0] as {
      where: { organizationId: string; status: BriefingAttentionStatus };
      orderBy: unknown;
    };
    assert.equal(query.where.organizationId, "org_1");
    assert.equal(query.where.status, BriefingAttentionStatus.ACTIVE);
    assert.deepEqual(query.orderBy, [{ firstSurfacedAt: "asc" }, { id: "asc" }]);
  });

  it("filters by emailThreadIds when provided", async () => {
    let capturedWhere: Record<string, unknown> | null = null;

    await loadActiveAttentionRows(
      { organizationId: "org_1", emailThreadIds: ["thread_a", "thread_b"] },
      {
        findMany: async (args) => {
          capturedWhere = args.where as Record<string, unknown>;
          return [];
        },
      },
    );

    assert.deepEqual(capturedWhere?.emailThreadId, { in: ["thread_a", "thread_b"] });
  });

  it("uses prisma client by default", async () => {
    const original = prisma.emailThreadBriefingAttention;
    let called = false;

    Object.assign(prisma, {
      emailThreadBriefingAttention: {
        findMany: async () => {
          called = true;
          return [];
        },
      },
    });

    try {
      await loadActiveAttentionRows({ organizationId: "org_default" });
      assert.equal(called, true);
    } finally {
      Object.assign(prisma, { emailThreadBriefingAttention: original });
    }
  });
});
