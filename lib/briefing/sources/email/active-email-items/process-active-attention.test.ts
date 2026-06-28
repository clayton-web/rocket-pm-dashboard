import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BriefingAttentionStatus,
  BriefingItemCategory,
  BriefingItemUrgency,
  type EmailThreadBriefingAttention,
} from "@prisma/client";
import { processActiveEmailAttention } from "@/lib/briefing/sources/email/active-email-items/process-active-attention";

const ORG_ID = "org_1";
const THREAD_ID = "thread_carry";

function activeRow(): EmailThreadBriefingAttention {
  return {
    id: "attn_1",
    organizationId: ORG_ID,
    emailThreadId: THREAD_ID,
    status: BriefingAttentionStatus.ACTIVE,
    firstSurfacedAt: new Date("2026-06-25T07:00:00.000Z"),
    lastSurfacedAt: new Date("2026-06-25T14:00:00.000Z"),
    lastSurfacedRunId: "run_prior",
    surfacedAtOutboundCount: 0,
    summaryTitle: "Prior leak",
    category: BriefingItemCategory.TENANT,
    urgency: BriefingItemUrgency.HIGH,
    subject: "Leaking sink",
    summaryJson: { keyFacts: ["Still leaking"] },
    lastOutboundAt: null,
    resolvedAt: null,
    resolvedByUserId: null,
    resolutionReason: null,
    createdAt: new Date("2026-06-25T07:00:00.000Z"),
    updatedAt: new Date("2026-06-25T14:00:00.000Z"),
  };
}

describe("processActiveEmailAttention", () => {
  it("carries forward active rows with inbound messages and no outbound reply", async () => {
    const result = await processActiveEmailAttention(
      { organizationId: ORG_ID, persistClears: false },
      {
        loadActiveAttentionRows: async () => [activeRow()],
        loadAttentionThreadSnapshots: async () =>
          new Map([
            [
              THREAD_ID,
              {
                emailThreadId: THREAD_ID,
                providerThreadId: "gmail_1",
                subject: "Leaking sink",
                messages: [
                  {
                    isOutbound: false,
                    sentAt: new Date("2026-06-26T12:00:00.000Z"),
                  },
                ],
                hasInboundMessage: true,
              },
            ],
          ]),
      },
    );

    assert.equal(result.carryForward.length, 1);
    assert.equal(result.clearedCount, 0);
    assert.equal(result.activeRowsConsidered, 1);
  });

  it("auto-resolves and does not carry forward after outbound reply", async () => {
    let appliedStatus: BriefingAttentionStatus | null = null;

    const result = await processActiveEmailAttention(
      { organizationId: ORG_ID, persistClears: true },
      {
        loadActiveAttentionRows: async () => [activeRow()],
        loadAttentionThreadSnapshots: async () =>
          new Map([
            [
              THREAD_ID,
              {
                emailThreadId: THREAD_ID,
                providerThreadId: "gmail_1",
                subject: "Leaking sink",
                messages: [
                  {
                    isOutbound: true,
                    sentAt: new Date("2026-06-26T13:00:00.000Z"),
                  },
                  {
                    isOutbound: false,
                    sentAt: new Date("2026-06-26T12:00:00.000Z"),
                  },
                ],
                hasInboundMessage: false,
              },
            ],
          ]),
        applyAttentionEvaluation: async (args) => {
          appliedStatus = args.status;
          return activeRow();
        },
      },
    );

    assert.equal(result.carryForward.length, 0);
    assert.equal(result.clearedCount, 1);
    assert.equal(appliedStatus, BriefingAttentionStatus.RESOLVED);
  });

  it("does not persist clears when persistClears is false", async () => {
    let applyCalled = false;

    await processActiveEmailAttention(
      { organizationId: ORG_ID, persistClears: false },
      {
        loadActiveAttentionRows: async () => [activeRow()],
        loadAttentionThreadSnapshots: async () =>
          new Map([
            [
              THREAD_ID,
              {
                emailThreadId: THREAD_ID,
                providerThreadId: "gmail_1",
                subject: "Leaking sink",
                messages: [
                  {
                    isOutbound: true,
                    sentAt: new Date("2026-06-26T13:00:00.000Z"),
                  },
                ],
                hasInboundMessage: false,
              },
            ],
          ]),
        applyAttentionEvaluation: async () => {
          applyCalled = true;
          return activeRow();
        },
      },
    );

    assert.equal(applyCalled, false);
  });
});
