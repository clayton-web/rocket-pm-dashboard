import { BriefingAttentionStatus } from "@prisma/client";
import { detectOutboundReplyAfter } from "@/lib/briefing/sources/email/active-email-items/detect-outbound-reply";
import {
  ATTENTION_RESOLUTION_REASON,
  type EvaluateAttentionStatusInput,
  type EvaluateAttentionStatusResult,
} from "@/lib/briefing/sources/email/active-email-items/types";

const TERMINAL_STATUSES = new Set<BriefingAttentionStatus>([
  BriefingAttentionStatus.RESOLVED,
  BriefingAttentionStatus.REVIEWED,
  BriefingAttentionStatus.ARCHIVED,
]);

function terminalResult(
  status: BriefingAttentionStatus,
  resolutionReason: EvaluateAttentionStatusResult["resolutionReason"] = null,
): EvaluateAttentionStatusResult {
  return {
    status,
    resolutionReason,
    lastOutboundAt: null,
    shouldCarryForward: false,
  };
}

/**
 * Deterministic attention status for a registry row before carry-forward.
 * Pure function — does not read or write the database.
 */
export function evaluateAttentionStatus(
  input: EvaluateAttentionStatusInput,
): EvaluateAttentionStatusResult {
  const autoResolveOnReply = input.autoResolveOnReply ?? true;

  if (TERMINAL_STATUSES.has(input.registry.status)) {
    return terminalResult(input.registry.status);
  }

  if (input.registry.status === BriefingAttentionStatus.REPLIED && autoResolveOnReply) {
    return terminalResult(
      BriefingAttentionStatus.RESOLVED,
      ATTENTION_RESOLUTION_REASON.OUTBOUND_REPLY_DETECTED,
    );
  }

  if (input.registry.status === BriefingAttentionStatus.REPLIED) {
    return {
      status: BriefingAttentionStatus.REPLIED,
      resolutionReason: ATTENTION_RESOLUTION_REASON.OUTBOUND_REPLY_DETECTED,
      lastOutboundAt: detectOutboundReplyAfter({
        messages: input.messages,
        after: input.registry.firstSurfacedAt,
      }),
      shouldCarryForward: false,
    };
  }

  const replyAt = detectOutboundReplyAfter({
    messages: input.messages,
    after: input.registry.firstSurfacedAt,
  });

  if (replyAt) {
    if (autoResolveOnReply) {
      return {
        status: BriefingAttentionStatus.RESOLVED,
        resolutionReason: ATTENTION_RESOLUTION_REASON.OUTBOUND_REPLY_DETECTED,
        lastOutboundAt: replyAt,
        shouldCarryForward: false,
      };
    }

    return {
      status: BriefingAttentionStatus.REPLIED,
      resolutionReason: ATTENTION_RESOLUTION_REASON.OUTBOUND_REPLY_DETECTED,
      lastOutboundAt: replyAt,
      shouldCarryForward: false,
    };
  }

  if (!input.hasInboundMessage) {
    return {
      status: BriefingAttentionStatus.RESOLVED,
      resolutionReason: ATTENTION_RESOLUTION_REASON.NO_INBOUND_REMAINING,
      lastOutboundAt: null,
      shouldCarryForward: false,
    };
  }

  return {
    status: BriefingAttentionStatus.ACTIVE,
    resolutionReason: null,
    lastOutboundAt: null,
    shouldCarryForward: true,
  };
}
