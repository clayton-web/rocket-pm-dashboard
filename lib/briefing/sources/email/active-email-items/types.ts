import type {
  BriefingAttentionStatus,
  BriefingItemCategory,
  BriefingItemUrgency,
} from "@prisma/client";

export const ATTENTION_RESOLUTION_REASON = {
  MANUAL: "manual",
  OUTBOUND_REPLY_DETECTED: "outbound_reply_detected",
  NO_INBOUND_REMAINING: "no_inbound_remaining",
} as const;

export type AttentionResolutionReason =
  (typeof ATTENTION_RESOLUTION_REASON)[keyof typeof ATTENTION_RESOLUTION_REASON];

export type AttentionMessageSnapshot = {
  isOutbound: boolean;
  sentAt: Date;
};

export type AttentionRegistrySnapshot = {
  status: BriefingAttentionStatus;
  firstSurfacedAt: Date;
  surfacedAtOutboundCount: number;
};

export type EvaluateAttentionStatusInput = {
  registry: AttentionRegistrySnapshot;
  messages: AttentionMessageSnapshot[];
  /** True when the latest message in the thread is inbound (needs reply). */
  hasInboundMessage: boolean;
  /** Default true for MVP — clears registry when outbound reply detected. */
  autoResolveOnReply?: boolean;
};

export type EvaluateAttentionStatusResult = {
  status: BriefingAttentionStatus;
  resolutionReason: AttentionResolutionReason | null;
  lastOutboundAt: Date | null;
  shouldCarryForward: boolean;
};

export type UpsertAttentionRegistryInput = {
  organizationId: string;
  emailThreadId: string;
  summaryTitle: string;
  category: BriefingItemCategory;
  urgency: BriefingItemUrgency;
  subject?: string | null;
  summaryJson?: Record<string, unknown> | null;
  firstSurfacedAt?: Date;
  lastSurfacedRunId?: string | null;
  lastSurfacedAt?: Date | null;
  surfacedAtOutboundCount?: number;
  messages?: AttentionMessageSnapshot[];
};
