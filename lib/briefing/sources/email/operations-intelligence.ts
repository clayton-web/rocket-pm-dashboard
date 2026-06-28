import {
  BriefingItemCategory,
  BriefingItemUrgency,
  type EmailThreadCategory,
} from "@prisma/client";
import type { BriefingEntityHints } from "@/lib/briefing/briefing-types";
import { BRIEFING_FILTER_REASON } from "@/lib/briefing/briefing-filters";
import { BRIEFING_ATTENTION_SECTION } from "@/lib/briefing/sources/email/briefing-attention-constants";

export const BRIEFING_WAITING_ON = {
  TENANT: "TENANT",
  OWNER: "OWNER",
  VENDOR: "VENDOR",
  PROPERTY_MANAGER: "PROPERTY_MANAGER",
  STRATA: "STRATA",
  APPLICANT: "APPLICANT",
  SYSTEM: "SYSTEM",
  UNKNOWN: "UNKNOWN",
} as const;

export type BriefingWaitingOn =
  (typeof BRIEFING_WAITING_ON)[keyof typeof BRIEFING_WAITING_ON];

export const BRIEFING_NEXT_ACTION = {
  REPLY: "REPLY",
  FOLLOW_UP: "FOLLOW_UP",
  REQUEST_APPROVAL: "REQUEST_APPROVAL",
  SCHEDULE_WORK: "SCHEDULE_WORK",
  REVIEW: "REVIEW",
  AWAIT_RESPONSE: "AWAIT_RESPONSE",
} as const;

export type BriefingNextAction =
  (typeof BRIEFING_NEXT_ACTION)[keyof typeof BRIEFING_NEXT_ACTION];

export const BRIEFING_WAITING_ON_LABELS: Record<BriefingWaitingOn, string> = {
  TENANT: "Tenant",
  OWNER: "Owner",
  VENDOR: "Vendor",
  PROPERTY_MANAGER: "Property Manager",
  STRATA: "Strata",
  APPLICANT: "Applicant",
  SYSTEM: "System",
  UNKNOWN: "Unknown",
};

export const BRIEFING_NEXT_ACTION_LABELS: Record<BriefingNextAction, string> = {
  REPLY: "Reply",
  FOLLOW_UP: "Follow up",
  REQUEST_APPROVAL: "Request approval",
  SCHEDULE_WORK: "Schedule work",
  REVIEW: "Review",
  AWAIT_RESPONSE: "Await response",
};

export const BRIEFING_PRIORITY_LABELS: Record<BriefingItemUrgency, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

export const BRIEFING_ATTENTION_SECTION_EMAIL_LABELS = {
  [BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW]: "New Items",
  [BRIEFING_ATTENTION_SECTION.STILL_NEEDS_ATTENTION]: "Still Needs Attention",
} as const;

const SYSTEM_SENDER_PATTERN =
  /(?:^|[@.])(?:no[-_.]?reply|donotreply|notifications?|mailer-daemon|postmaster|bounce)/i;

const VENDOR_KEYWORD_PATTERN =
  /\b(?:plumber|electrician|hvac|contractor|vendor|technician|repair company|restoration)\b/i;

const RTB_KEYWORD_PATTERN = /\b(?:rtb|residential tenancy|tenancy act|tribunal|dispute resolution)\b/i;

const MAINTENANCE_KEYWORD_PATTERN =
  /\b(?:maintenance|repair|fix|broken|leak|leaking|plumber|hvac|appliance)\b/i;

export type EmailOperationsIntelligenceInput = {
  category: BriefingItemCategory;
  urgency: BriefingItemUrgency;
  attentionSection?: string | null;
  latestMessageIsInbound: boolean;
  reasonCodes?: string[];
  entityHints?: BriefingEntityHints;
  senderEmail?: string | null;
  subject?: string | null;
  excerpt?: string | null;
  requiredAction?: string | null;
  emailThreadCategory?: EmailThreadCategory | null;
};

export type EmailOperationsIntelligenceFields = {
  waitingOn: BriefingWaitingOn;
  nextAction: BriefingNextAction;
  firstSurfacedAt: string;
  ageDays: number;
  ageLabel: string;
};

export function isSystemSenderEmail(senderEmail: string | null | undefined): boolean {
  if (!senderEmail) return false;
  return SYSTEM_SENDER_PATTERN.test(senderEmail.trim());
}

export function computeAgeDays(firstSurfacedAt: Date, referenceDate: Date): number {
  const start = startOfUtcDay(firstSurfacedAt);
  const end = startOfUtcDay(referenceDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export function formatBriefingItemAge(firstSurfacedAt: Date, referenceDate: Date): string {
  const days = computeAgeDays(firstSurfacedAt, referenceDate);
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function collectSignalText(input: EmailOperationsIntelligenceInput): string {
  return [input.subject, input.excerpt, input.requiredAction].filter(Boolean).join("\n");
}

export function deriveCounterpartyWaitingOn(
  input: EmailOperationsIntelligenceInput,
): BriefingWaitingOn {
  if (isSystemSenderEmail(input.senderEmail)) {
    return BRIEFING_WAITING_ON.SYSTEM;
  }

  const reasonCodes = input.reasonCodes ?? [];

  if (reasonCodes.includes(BRIEFING_FILTER_REASON.STRATA_IDENTIFIER)) {
    return BRIEFING_WAITING_ON.STRATA;
  }
  if (input.category === BriefingItemCategory.STRATA) {
    return BRIEFING_WAITING_ON.STRATA;
  }
  if (
    reasonCodes.includes(BRIEFING_FILTER_REASON.MATCHED_APPLICATION_EMAIL) ||
    reasonCodes.includes(BRIEFING_FILTER_REASON.MATCHED_PROSPECT_EMAIL)
  ) {
    return BRIEFING_WAITING_ON.APPLICANT;
  }
  if (
    reasonCodes.includes(BRIEFING_FILTER_REASON.MATCHED_OWNER_EMAIL) ||
    input.category === BriefingItemCategory.LANDLORD
  ) {
    return BRIEFING_WAITING_ON.OWNER;
  }
  if (
    reasonCodes.includes(BRIEFING_FILTER_REASON.MATCHED_TENANT_EMAIL) ||
    input.category === BriefingItemCategory.TENANT
  ) {
    return BRIEFING_WAITING_ON.TENANT;
  }
  if (
    input.category === BriefingItemCategory.MAINTENANCE ||
    VENDOR_KEYWORD_PATTERN.test(collectSignalText(input))
  ) {
    return BRIEFING_WAITING_ON.VENDOR;
  }
  if (input.emailThreadCategory === "TENANT_INQUIRY") {
    return BRIEFING_WAITING_ON.APPLICANT;
  }

  return BRIEFING_WAITING_ON.UNKNOWN;
}

export function deriveWaitingOn(input: EmailOperationsIntelligenceInput): BriefingWaitingOn {
  if (input.latestMessageIsInbound) {
    return BRIEFING_WAITING_ON.PROPERTY_MANAGER;
  }

  return deriveCounterpartyWaitingOn(input);
}

export function deriveNextAction(input: EmailOperationsIntelligenceInput): BriefingNextAction {
  const signalText = collectSignalText(input);

  if (!input.latestMessageIsInbound) {
    return BRIEFING_NEXT_ACTION.AWAIT_RESPONSE;
  }

  if (input.attentionSection === BRIEFING_ATTENTION_SECTION.STILL_NEEDS_ATTENTION) {
    if (
      input.category === BriefingItemCategory.MAINTENANCE ||
      MAINTENANCE_KEYWORD_PATTERN.test(signalText)
    ) {
      return BRIEFING_NEXT_ACTION.FOLLOW_UP;
    }
    return BRIEFING_NEXT_ACTION.FOLLOW_UP;
  }

  if (
    input.category === BriefingItemCategory.URGENT ||
    RTB_KEYWORD_PATTERN.test(signalText) ||
    reasonCodesInclude(input, BRIEFING_FILTER_REASON.RTB_REVIEW_NEEDED)
  ) {
    return BRIEFING_NEXT_ACTION.REVIEW;
  }

  if (
    input.category === BriefingItemCategory.MAINTENANCE ||
    MAINTENANCE_KEYWORD_PATTERN.test(signalText) ||
    reasonCodesInclude(input, BRIEFING_FILTER_REASON.EMAIL_MENTION_MAINTENANCE)
  ) {
    return BRIEFING_NEXT_ACTION.SCHEDULE_WORK;
  }

  if (
    input.category === BriefingItemCategory.LANDLORD ||
    input.category === BriefingItemCategory.RENT_DEPOSIT
  ) {
    return BRIEFING_NEXT_ACTION.REQUEST_APPROVAL;
  }

  if (input.category === BriefingItemCategory.STRATA) {
    return BRIEFING_NEXT_ACTION.REPLY;
  }

  return BRIEFING_NEXT_ACTION.REPLY;
}

function reasonCodesInclude(
  input: EmailOperationsIntelligenceInput,
  code: string,
): boolean {
  return (input.reasonCodes ?? []).includes(code);
}

export function deriveEmailOperationsIntelligence(args: {
  input: EmailOperationsIntelligenceInput;
  firstSurfacedAt: Date;
  referenceDate: Date;
}): EmailOperationsIntelligenceFields {
  const waitingOn = deriveWaitingOn(args.input);
  const nextAction = deriveNextAction(args.input);
  const ageDays = computeAgeDays(args.firstSurfacedAt, args.referenceDate);
  const ageLabel = formatBriefingItemAge(args.firstSurfacedAt, args.referenceDate);

  return {
    waitingOn,
    nextAction,
    firstSurfacedAt: args.firstSurfacedAt.toISOString(),
    ageDays,
    ageLabel,
  };
}

export type BriefingOperationsSummaryJson = {
  waitingOn?: BriefingWaitingOn;
  nextAction?: BriefingNextAction;
  firstSurfacedAt?: string;
  ageDays?: number;
  ageLabel?: string;
};

export function parseOperationsSummaryJson(
  value: Record<string, unknown> | null | undefined,
): BriefingOperationsSummaryJson {
  if (!value) return {};

  const waitingOn = value.waitingOn;
  const nextAction = value.nextAction;

  return {
    waitingOn:
      typeof waitingOn === "string" &&
      Object.values(BRIEFING_WAITING_ON).includes(waitingOn as BriefingWaitingOn)
        ? (waitingOn as BriefingWaitingOn)
        : undefined,
    nextAction:
      typeof nextAction === "string" &&
      Object.values(BRIEFING_NEXT_ACTION).includes(nextAction as BriefingNextAction)
        ? (nextAction as BriefingNextAction)
        : undefined,
    firstSurfacedAt:
      typeof value.firstSurfacedAt === "string" ? value.firstSurfacedAt : undefined,
    ageDays: typeof value.ageDays === "number" ? value.ageDays : undefined,
    ageLabel: typeof value.ageLabel === "string" ? value.ageLabel : undefined,
  };
}

export function mergeOperationsIntoSummaryJson(args: {
  summaryJson: Record<string, unknown>;
  operations: EmailOperationsIntelligenceFields;
}): Record<string, unknown> {
  return {
    ...args.summaryJson,
    waitingOn: args.operations.waitingOn,
    nextAction: args.operations.nextAction,
    firstSurfacedAt: args.operations.firstSurfacedAt,
    ageDays: args.operations.ageDays,
    ageLabel: args.operations.ageLabel,
  };
}

export function resolveOperationsForBriefingItemView(args: {
  summary: BriefingOperationsSummaryJson & {
    requiredAction?: string | null;
  };
  category: BriefingItemCategory;
  urgency: BriefingItemUrgency;
  attentionSection?: string | null;
  referenceDate?: Date;
}): {
  waitingOn: BriefingWaitingOn;
  nextAction: BriefingNextAction;
  ageLabel: string;
  ageDays: number;
} {
  const referenceDate = args.referenceDate ?? new Date();
  const firstSurfacedAt = args.summary.firstSurfacedAt
    ? new Date(args.summary.firstSurfacedAt)
    : referenceDate;

  if (args.summary.waitingOn && args.summary.nextAction && args.summary.ageLabel != null) {
    return {
      waitingOn: args.summary.waitingOn,
      nextAction: args.summary.nextAction,
      ageLabel: args.summary.ageLabel,
      ageDays: args.summary.ageDays ?? computeAgeDays(firstSurfacedAt, referenceDate),
    };
  }

  const fallback = deriveEmailOperationsIntelligence({
    input: {
      category: args.category,
      urgency: args.urgency,
      attentionSection: args.attentionSection,
      latestMessageIsInbound: true,
      requiredAction: args.summary.requiredAction ?? null,
    },
    firstSurfacedAt,
    referenceDate,
  });

  return {
    waitingOn: fallback.waitingOn,
    nextAction: fallback.nextAction,
    ageLabel: fallback.ageLabel,
    ageDays: fallback.ageDays,
  };
}
