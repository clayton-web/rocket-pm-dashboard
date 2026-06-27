import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BriefingAttentionStatus,
  BriefingItemCategory,
  BriefingItemUrgency,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import {
  applyAttentionEvaluation,
  markAttentionResolved,
  upsertAttentionRegistry,
} from "@/lib/briefing/sources/email/active-email-items/upsert-attention-registry";

describe("upsertAttentionRegistry", () => {
  it("upserts by organizationId + emailThreadId composite key", async () => {
    const calls: unknown[] = [];

    await upsertAttentionRegistry(
      {
        organizationId: "org_1",
        emailThreadId: "thread_1",
        summaryTitle: "Tenant leak report",
        category: BriefingItemCategory.MAINTENANCE,
        urgency: BriefingItemUrgency.HIGH,
        subject: "Leak in unit 2",
        summaryJson: { keyFacts: ["Email mentions active leak"] },
        firstSurfacedAt: new Date("2026-06-26T10:00:00.000Z"),
        lastSurfacedRunId: "run_1",
        messages: [{ isOutbound: true, sentAt: new Date("2026-06-26T09:00:00.000Z") }],
      },
      {
        upsert: async (args) => {
          calls.push(args);
          return { id: "attn_1", ...(args.create as object) };
        },
      },
    );

    assert.equal(calls.length, 1);
    const call = calls[0] as {
      where: { organizationId_emailThreadId: { organizationId: string; emailThreadId: string } };
      create: { status: BriefingAttentionStatus; surfacedAtOutboundCount: number };
      update: { status: BriefingAttentionStatus; resolvedAt: null };
    };

    assert.deepEqual(call.where.organizationId_emailThreadId, {
      organizationId: "org_1",
      emailThreadId: "thread_1",
    });
    assert.equal(call.create.status, BriefingAttentionStatus.ACTIVE);
    assert.equal(call.create.surfacedAtOutboundCount, 1);
    assert.equal(call.update.status, BriefingAttentionStatus.ACTIVE);
    assert.equal(call.update.resolvedAt, null);
  });

  it("is idempotent for the same org + thread pair", async () => {
    let upsertCount = 0;

    const input = {
      organizationId: "org_1",
      emailThreadId: "thread_1",
      summaryTitle: "First title",
      category: BriefingItemCategory.TENANT,
      urgency: BriefingItemUrgency.NORMAL,
    };

    const deps = {
      upsert: async () => {
        upsertCount += 1;
        return { id: "attn_1" };
      },
    };

    await upsertAttentionRegistry(input, deps);
    await upsertAttentionRegistry(
      { ...input, summaryTitle: "Updated title", lastSurfacedRunId: "run_2" },
      deps,
    );

    assert.equal(upsertCount, 2);
  });
});

describe("markAttentionResolved", () => {
  it("updates status to RESOLVED with resolution metadata", async () => {
    const calls: unknown[] = [];

    await markAttentionResolved(
      {
        organizationId: "org_1",
        emailThreadId: "thread_1",
        resolvedByUserId: "user_1",
        resolutionReason: "manual",
      },
      {
        update: async (args) => {
          calls.push(args);
          return { id: "attn_1" };
        },
      },
    );

    const call = calls[0] as { data: { status: BriefingAttentionStatus; resolvedByUserId: string } };
    assert.equal(call.data.status, BriefingAttentionStatus.RESOLVED);
    assert.equal(call.data.resolvedByUserId, "user_1");
  });
});

describe("applyAttentionEvaluation", () => {
  it("persists REPLIED evaluation with outbound timestamp", async () => {
    const calls: unknown[] = [];
    const lastOutboundAt = new Date("2026-06-26T11:00:00.000Z");

    await applyAttentionEvaluation(
      {
        organizationId: "org_1",
        emailThreadId: "thread_1",
        status: BriefingAttentionStatus.REPLIED,
        resolutionReason: "outbound_reply_detected",
        lastOutboundAt,
      },
      {
        update: async (args) => {
          calls.push(args);
          return { id: "attn_1" };
        },
      },
    );

    const call = calls[0] as {
      data: {
        status: BriefingAttentionStatus;
        lastOutboundAt: Date;
        resolvedAt: Date;
      };
    };
    assert.equal(call.data.status, BriefingAttentionStatus.REPLIED);
    assert.equal(call.data.lastOutboundAt.toISOString(), lastOutboundAt.toISOString());
    assert.ok(call.data.resolvedAt instanceof Date);
  });

  it("uses prisma client by default for upsert", async () => {
    const original = prisma.emailThreadBriefingAttention;
    let called = false;

    Object.assign(prisma, {
      emailThreadBriefingAttention: {
        upsert: async () => {
          called = true;
          return { id: "attn_1" };
        },
      },
    });

    try {
      await upsertAttentionRegistry({
        organizationId: "org_1",
        emailThreadId: "thread_1",
        summaryTitle: "Test",
        category: BriefingItemCategory.GENERAL_ADMIN,
        urgency: BriefingItemUrgency.LOW,
      });
      assert.equal(called, true);
    } finally {
      Object.assign(prisma, { emailThreadBriefingAttention: original });
    }
  });
});
