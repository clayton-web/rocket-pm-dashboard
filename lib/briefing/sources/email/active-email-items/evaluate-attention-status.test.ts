import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingAttentionStatus } from "@prisma/client";
import { evaluateAttentionStatus } from "@/lib/briefing/sources/email/active-email-items/evaluate-attention-status";
import { ATTENTION_RESOLUTION_REASON } from "@/lib/briefing/sources/email/active-email-items/types";

const firstSurfacedAt = new Date("2026-06-26T10:00:00.000Z");

function baseRegistry(overrides: Record<string, unknown> = {}) {
  return {
    status: BriefingAttentionStatus.ACTIVE,
    firstSurfacedAt,
    surfacedAtOutboundCount: 0,
    ...overrides,
  };
}

describe("evaluateAttentionStatus", () => {
  it("keeps ACTIVE when inbound remains and no outbound reply after surface", () => {
    const result = evaluateAttentionStatus({
      registry: baseRegistry(),
      hasInboundMessage: true,
      messages: [{ isOutbound: false, sentAt: new Date("2026-06-26T11:00:00.000Z") }],
    });

    assert.equal(result.status, BriefingAttentionStatus.ACTIVE);
    assert.equal(result.shouldCarryForward, true);
    assert.equal(result.resolutionReason, null);
  });

  it("auto-resolves to RESOLVED when outbound reply is detected after firstSurfacedAt", () => {
    const result = evaluateAttentionStatus({
      registry: baseRegistry(),
      hasInboundMessage: true,
      messages: [{ isOutbound: true, sentAt: new Date("2026-06-26T10:30:00.000Z") }],
    });

    assert.equal(result.status, BriefingAttentionStatus.RESOLVED);
    assert.equal(result.resolutionReason, ATTENTION_RESOLUTION_REASON.OUTBOUND_REPLY_DETECTED);
    assert.equal(result.shouldCarryForward, false);
    assert.equal(result.lastOutboundAt?.toISOString(), "2026-06-26T10:30:00.000Z");
  });

  it("returns REPLIED without auto-resolve when autoResolveOnReply is false", () => {
    const result = evaluateAttentionStatus({
      registry: baseRegistry(),
      hasInboundMessage: true,
      autoResolveOnReply: false,
      messages: [{ isOutbound: true, sentAt: new Date("2026-06-26T10:30:00.000Z") }],
    });

    assert.equal(result.status, BriefingAttentionStatus.REPLIED);
    assert.equal(result.shouldCarryForward, false);
  });

  it("resolves with no_inbound_remaining when latest message is outbound-only", () => {
    const result = evaluateAttentionStatus({
      registry: baseRegistry(),
      hasInboundMessage: false,
      messages: [{ isOutbound: true, sentAt: new Date("2026-06-26T09:00:00.000Z") }],
    });

    assert.equal(result.status, BriefingAttentionStatus.RESOLVED);
    assert.equal(result.resolutionReason, ATTENTION_RESOLUTION_REASON.NO_INBOUND_REMAINING);
    assert.equal(result.shouldCarryForward, false);
  });

  it("does not carry forward terminal RESOLVED rows", () => {
    const result = evaluateAttentionStatus({
      registry: baseRegistry({ status: BriefingAttentionStatus.RESOLVED }),
      hasInboundMessage: true,
      messages: [{ isOutbound: false, sentAt: new Date("2026-06-26T11:00:00.000Z") }],
    });

    assert.equal(result.status, BriefingAttentionStatus.RESOLVED);
    assert.equal(result.shouldCarryForward, false);
  });

  it("does not carry forward REVIEWED or ARCHIVED rows", () => {
    for (const status of [BriefingAttentionStatus.REVIEWED, BriefingAttentionStatus.ARCHIVED]) {
      const result = evaluateAttentionStatus({
        registry: baseRegistry({ status }),
        hasInboundMessage: true,
        messages: [],
      });

      assert.equal(result.status, status);
      assert.equal(result.shouldCarryForward, false);
    }
  });
});
