import type { EmailThreadBriefingAttention, Prisma } from "@prisma/client";
import {
  BriefingAttentionLabel,
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingSourceType,
} from "@prisma/client";
import type {
  BriefingOutputItem,
  NormalizedBriefingOutput,
} from "@/lib/ai/briefing/briefing-output.schema";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";
import { BRIEFING_ATTENTION_SECTION } from "@/lib/briefing/sources/email/briefing-attention-constants";
import type { BriefingEmailItemPersistMeta } from "@/lib/briefing/sources/types";

function parseRegistrySummaryJson(value: Prisma.JsonValue | null): {
  keyFacts: string[];
  requiredAction: string | null;
  suggestedReplyNotes: string | null;
  sender: string | null;
  senderEmail: string | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      keyFacts: [],
      requiredAction: null,
      suggestedReplyNotes: null,
      sender: null,
      senderEmail: null,
    };
  }

  const raw = value as Record<string, unknown>;
  return {
    keyFacts: Array.isArray(raw.keyFacts)
      ? raw.keyFacts.filter((fact): fact is string => typeof fact === "string")
      : [],
    requiredAction: typeof raw.requiredAction === "string" ? raw.requiredAction : null,
    suggestedReplyNotes:
      typeof raw.suggestedReplyNotes === "string" ? raw.suggestedReplyNotes : null,
    sender: typeof raw.sender === "string" ? raw.sender : null,
    senderEmail: typeof raw.senderEmail === "string" ? raw.senderEmail : null,
  };
}

export function buildCarryForwardOutputItem(
  row: EmailThreadBriefingAttention,
): BriefingOutputItem {
  const summary = parseRegistrySummaryJson(row.summaryJson);

  return {
    sourceType: BriefingSourceType.EMAIL,
    sourceThreadId: row.emailThreadId,
    summaryTitle: row.summaryTitle,
    category: row.category as BriefingItemCategory,
    urgency: row.urgency as BriefingItemUrgency,
    keyFacts: summary.keyFacts,
    requiredAction: summary.requiredAction ?? undefined,
    suggestedReplyNotes: summary.suggestedReplyNotes ?? undefined,
    isPropertyManagementRelated: true,
    dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
  };
}

export function buildCarryForwardPersistMeta(
  row: EmailThreadBriefingAttention,
): BriefingEmailItemPersistMeta {
  const summary = parseRegistrySummaryJson(row.summaryJson);

  return {
    attentionLabel: BriefingAttentionLabel.STILL_ACTIVE,
    attentionSection: BRIEFING_ATTENTION_SECTION.STILL_NEEDS_ATTENTION,
    emailThreadBriefingAttentionId: row.id,
    subject: row.subject,
    summaryJson: {
      keyFacts: summary.keyFacts,
      requiredAction: summary.requiredAction,
      suggestedReplyNotes: summary.suggestedReplyNotes,
      dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
      isPropertyManagementRelated: true,
      sender: summary.sender,
      senderEmail: summary.senderEmail,
    },
  };
}

export function buildNewWindowPersistMeta(args: {
  subject: string | null;
  emailThreadBriefingAttentionId: string;
  summaryJson: BriefingEmailItemPersistMeta["summaryJson"];
}): BriefingEmailItemPersistMeta {
  return {
    attentionLabel: BriefingAttentionLabel.NEW,
    attentionSection: BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
    emailThreadBriefingAttentionId: args.emailThreadBriefingAttentionId,
    subject: args.subject,
    summaryJson: args.summaryJson,
  };
}

export function mergeEmailBriefingOutput(args: {
  geminiOutput: NormalizedBriefingOutput | null;
  carryForwardRows: EmailThreadBriefingAttention[];
  windowIncludedCount: number;
  scannedCount: number;
  skippedCount: number;
}): NormalizedBriefingOutput {
  const carryForwardItems = args.carryForwardRows.map(buildCarryForwardOutputItem);
  const geminiSections = args.geminiOutput?.sections ?? [];
  const geminiItems = geminiSections.flatMap((section) => section.items);

  const itemsByCategory = new Map<BriefingItemCategory, BriefingOutputItem[]>();

  for (const item of [...carryForwardItems, ...geminiItems]) {
    const list = itemsByCategory.get(item.category) ?? [];
    list.push(item);
    itemsByCategory.set(item.category, list);
  }

  const sections = [...itemsByCategory.entries()].map(([category, items]) => ({
    category,
    items,
  }));

  const includedCount = carryForwardItems.length + geminiItems.length;
  const carryForwardCount = carryForwardItems.length;

  let executiveSummary =
    args.geminiOutput?.executiveSummary ??
    (carryForwardCount > 0
      ? `${carryForwardCount} item(s) still need attention from prior briefings.`
      : "No property-management email threads matched the briefing filters for this window.");

  if (args.geminiOutput?.executiveSummary && carryForwardCount > 0) {
    executiveSummary = `${args.geminiOutput.executiveSummary} ${carryForwardCount} item(s) still need attention from prior briefings.`;
  }

  return {
    summaryTitle:
      args.geminiOutput?.summaryTitle ??
      `Daily Briefing — ${carryForwardCount} still need attention`,
    executiveSummary,
    estimatedReadingMinutes:
      args.geminiOutput?.estimatedReadingMinutes ??
      Math.max(1, Math.min(120, includedCount * 2)),
    scannedCount: args.scannedCount,
    includedCount,
    skippedCount: args.skippedCount,
    sections,
    suggestedFollowUpActions: args.geminiOutput?.suggestedFollowUpActions ?? [],
    warnings: args.geminiOutput?.warnings ?? [],
  };
}

export function dedupeCarryForwardAgainstWindowThreads(args: {
  carryForward: EmailThreadBriefingAttention[];
  windowThreadIds: Set<string>;
}): EmailThreadBriefingAttention[] {
  return args.carryForward.filter((row) => !args.windowThreadIds.has(row.emailThreadId));
}
