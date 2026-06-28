import type { BriefingContextThreadItem } from "@/lib/briefing/briefing-types";
import type { BriefingEmailItemPersistMeta } from "@/lib/briefing/sources/types";
import {
  deriveEmailOperationsIntelligence,
  mergeOperationsIntoSummaryJson,
  type EmailOperationsIntelligenceInput,
} from "@/lib/briefing/sources/email/operations-intelligence";

export function buildOperationsIntelligenceInputFromContextThread(args: {
  thread: BriefingContextThreadItem;
  category: EmailOperationsIntelligenceInput["category"];
  urgency: EmailOperationsIntelligenceInput["urgency"];
  attentionSection?: string | null;
  requiredAction?: string | null;
}): EmailOperationsIntelligenceInput {
  return {
    category: args.category,
    urgency: args.urgency,
    attentionSection: args.attentionSection,
    latestMessageIsInbound: args.thread.latestMessageIsInbound,
    reasonCodes: args.thread.reasonCodes,
    entityHints: args.thread.entityHints,
    senderEmail: args.thread.senderEmail,
    subject: args.thread.subject,
    excerpt: args.thread.excerpt,
    requiredAction: args.requiredAction ?? null,
  };
}

export function buildOperationsIntelligenceInputWithoutThread(args: {
  category: EmailOperationsIntelligenceInput["category"];
  urgency: EmailOperationsIntelligenceInput["urgency"];
  attentionSection?: string | null;
  subject?: string | null;
  senderEmail?: string | null;
  requiredAction?: string | null;
  latestMessageIsInbound?: boolean;
}): EmailOperationsIntelligenceInput {
  return {
    category: args.category,
    urgency: args.urgency,
    attentionSection: args.attentionSection,
    latestMessageIsInbound: args.latestMessageIsInbound ?? true,
    reasonCodes: [],
    senderEmail: args.senderEmail ?? null,
    subject: args.subject ?? null,
    excerpt: null,
    requiredAction: args.requiredAction ?? null,
  };
}

export function parseFirstSurfacedAtFromSummary(
  summaryJson: Record<string, unknown>,
): Date | null {
  const value = summaryJson.firstSurfacedAt;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function enrichBriefingEmailSummaryJson(args: {
  summaryJson: Record<string, unknown>;
  operationsInput: EmailOperationsIntelligenceInput;
  firstSurfacedAt: Date;
  referenceDate: Date;
}): Record<string, unknown> {
  const operations = deriveEmailOperationsIntelligence({
    input: args.operationsInput,
    firstSurfacedAt: args.firstSurfacedAt,
    referenceDate: args.referenceDate,
  });

  return mergeOperationsIntoSummaryJson({
    summaryJson: args.summaryJson,
    operations,
  });
}

export function enrichBriefingEmailPersistMeta(args: {
  meta: BriefingEmailItemPersistMeta;
  operationsInput: EmailOperationsIntelligenceInput;
  firstSurfacedAt: Date;
  referenceDate: Date;
}): BriefingEmailItemPersistMeta {
  const summaryJson = args.meta.summaryJson ?? {};

  return {
    ...args.meta,
    summaryJson: enrichBriefingEmailSummaryJson({
      summaryJson,
      operationsInput: args.operationsInput,
      firstSurfacedAt: args.firstSurfacedAt,
      referenceDate: args.referenceDate,
    }),
  };
}
