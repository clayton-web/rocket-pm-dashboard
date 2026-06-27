import {
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingSourceType,
  type EmailThreadCategory,
} from "@prisma/client";
import {
  containsStrataCorporationIdentifier,
  evaluateDeterministicInboxFilters,
  type ThreadForDeterministicFilter,
} from "@/lib/ai/inbox-classification/deterministic-filters";
import { INBOX_CLASSIFICATION_MIN_CONFIDENCE } from "@/lib/ai/inbox-classification/constants";
import type {
  BriefingEmailFilterResult,
  BriefingEmailThreadCandidate,
  BriefingEntityHints,
} from "@/lib/briefing/briefing-types";
import { extractInboundSenderFromMessages } from "@/lib/inbox/extract-thread-sender";
import { normalizeSenderEmail } from "@/lib/inbox/normalize-sender-email";
import prisma from "@/lib/db/prisma";

export const BRIEFING_FILTER_REASON = {
  MATCHED_OWNER_EMAIL: "matched_owner_email",
  MATCHED_TENANT_EMAIL: "matched_tenant_email",
  MATCHED_PROSPECT_EMAIL: "matched_prospect_email",
  MATCHED_APPLICATION_EMAIL: "matched_application_email",
  STRATA_IDENTIFIER: "strata_identifier",
  INBOX_CATEGORY_CONFIDENT: "inbox_category_confident",
  PM_KEYWORD_SUPPORT: "pm_keyword_support",
  EMAIL_MENTION_RENT_DEPOSIT: "email_mention_rent_deposit",
  EMAIL_MENTION_MAINTENANCE: "email_mention_maintenance",
  RTB_REVIEW_NEEDED: "rtb_review_needed",
  SKIPPED_NO_PM_SIGNAL: "skipped_no_pm_signal",
  SKIPPED_OUTBOUND_ONLY: "skipped_outbound_only",
  SKIPPED_KEYWORD_ONLY: "skipped_keyword_only",
} as const;

const URGENT_KEYWORD_PATTERN =
  /\b(?:urgent|emergency|eviction|flood|fire|gas leak|no heat|no water|rtb|residential tenancy branch|tribunal|deadline today|same day)\b/i;

const HIGH_URGENCY_KEYWORD_PATTERN =
  /\b(?:broken|leak|leaking|mold|legal notice|notice to end|dispute|deposit return|rent increase|arrears|overdue rent)\b/i;

const PM_SUPPORT_KEYWORD_PATTERN =
  /\b(?:maintenance|repair|rent|deposit|lease|tenancy|move[- ]?out|move[- ]?in|inspection|showing|application|vacancy|strata|landlord|tenant|property management)\b/i;

const RTB_KEYWORD_PATTERN = /\b(?:rtb|residential tenancy|tenancy act|form \d+|dispute resolution)\b/i;

const MAINTENANCE_KEYWORD_PATTERN = /\b(?:maintenance|repair|fix|broken|leak|plumber|hvac|appliance)\b/i;

const RENT_DEPOSIT_KEYWORD_PATTERN = /\b(?:rent|deposit|arrears|nsf|payment|rent increase)\b/i;

function mapEmailCategoryToBriefingCategory(
  category: EmailThreadCategory,
): BriefingItemCategory | null {
  switch (category) {
    case "LANDLORD_COMMUNICATION":
      return BriefingItemCategory.LANDLORD;
    case "TENANT_COMMUNICATION":
      return BriefingItemCategory.TENANT;
    case "STRATA":
      return BriefingItemCategory.STRATA;
    case "TENANT_INQUIRY":
      return BriefingItemCategory.GENERAL_ADMIN;
    case "UNCATEGORIZED":
      return null;
    default:
      return null;
  }
}

function collectSafeFilterText(
  thread: Pick<BriefingEmailThreadCandidate, "subject" | "snippet">,
): string {
  return [thread.subject, thread.snippet].filter(Boolean).join("\n");
}

function hasInboundMessage(thread: BriefingEmailThreadCandidate): boolean {
  return thread.messages.some((message) => !message.isOutbound);
}

function detectUrgencyFromText(text: string): BriefingItemUrgency | null {
  if (URGENT_KEYWORD_PATTERN.test(text)) {
    return BriefingItemUrgency.URGENT;
  }
  if (HIGH_URGENCY_KEYWORD_PATTERN.test(text)) {
    return BriefingItemUrgency.HIGH;
  }
  return null;
}

function refineCategoryFromKeywords(text: string): BriefingItemCategory | null {
  if (containsStrataCorporationIdentifier(text)) {
    return BriefingItemCategory.STRATA;
  }
  if (RTB_KEYWORD_PATTERN.test(text)) {
    return BriefingItemCategory.URGENT;
  }
  if (MAINTENANCE_KEYWORD_PATTERN.test(text)) {
    return BriefingItemCategory.MAINTENANCE;
  }
  if (RENT_DEPOSIT_KEYWORD_PATTERN.test(text)) {
    return BriefingItemCategory.RENT_DEPOSIT;
  }
  return null;
}

function toDeterministicThread(thread: BriefingEmailThreadCandidate): ThreadForDeterministicFilter {
  return {
    organizationId: thread.organizationId,
    subject: thread.subject,
    snippet: thread.snippet,
    participantEmails: thread.participantEmails,
    messages: thread.messages.map((message) => ({
      fromAddr: message.fromAddr,
      isOutbound: message.isOutbound,
      sentAt: message.sentAt,
      bodyText: null,
    })),
  };
}

async function resolveEntityHints(args: {
  organizationId: string;
  senderEmail: string | null;
}): Promise<BriefingEntityHints> {
  const hints: BriefingEntityHints = {};
  if (!args.senderEmail) return hints;

  const property = await prisma.property.findFirst({
    where: {
      organizationId: args.organizationId,
      ownerEmail: { equals: args.senderEmail, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  if (property) {
    hints.propertyId = property.id;
    hints.propertyName = property.name;
    hints.landlordLabel = property.name;
    return hints;
  }

  const contact = await prisma.tenancyContact.findFirst({
    where: {
      email: { equals: args.senderEmail, mode: "insensitive" },
      tenancy: { unit: { property: { organizationId: args.organizationId } } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      tenancy: {
        select: {
          id: true,
          unit: {
            select: {
              unitNumber: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (contact) {
    hints.contactName = `${contact.firstName} ${contact.lastName}`.trim();
    hints.tenancyId = contact.tenancy.id;
    hints.propertyId = contact.tenancy.unit.property.id;
    hints.propertyName = contact.tenancy.unit.property.name;
    hints.unitLabel = contact.tenancy.unit.unitNumber;
    return hints;
  }

  const prospect = await prisma.prospect.findFirst({
    where: {
      email: { equals: args.senderEmail, mode: "insensitive" },
      property: { organizationId: args.organizationId },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  if (prospect) {
    hints.prospectId = prospect.id;
    hints.contactName = `${prospect.firstName ?? ""} ${prospect.lastName ?? ""}`.trim();
    return hints;
  }

  const application = await prisma.application.findFirst({
    where: {
      email: { equals: args.senderEmail, mode: "insensitive" },
      property: { organizationId: args.organizationId },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  if (application) {
    hints.applicationId = application.id;
    hints.contactName = `${application.firstName ?? ""} ${application.lastName ?? ""}`.trim();
  }

  return hints;
}

function computePriorityScore(args: {
  include: boolean;
  urgency: BriefingItemUrgency | null;
  isUnread: boolean;
  hasEntityMatch: boolean;
  hasConfidentCategory: boolean;
}): number {
  if (!args.include) return 0;

  let score = 10;
  if (args.urgency === BriefingItemUrgency.URGENT) score += 100;
  else if (args.urgency === BriefingItemUrgency.HIGH) score += 70;
  else if (args.urgency === BriefingItemUrgency.NORMAL) score += 30;
  if (args.isUnread) score += 20;
  if (args.hasEntityMatch) score += 15;
  if (args.hasConfidentCategory) score += 10;
  return score;
}

/**
 * Deterministic PM relevance filter for EMAIL briefing candidates.
 * Prefers safety over inclusion — unrelated personal email is excluded by default.
 */
export async function evaluateBriefingEmailFilter(
  thread: BriefingEmailThreadCandidate,
): Promise<BriefingEmailFilterResult> {
  const reasonCodes: string[] = [];
  const safeText = collectSafeFilterText(thread);

  if (!hasInboundMessage(thread)) {
    return {
      threadId: thread.id,
      include: false,
      sourceType: BriefingSourceType.EMAIL,
      categorySuggestion: null,
      urgencySuggestion: null,
      reasonCodes: [BRIEFING_FILTER_REASON.SKIPPED_OUTBOUND_ONLY],
      entityHints: {},
      priorityScore: 0,
    };
  }

  const inbound = extractInboundSenderFromMessages(thread.messages);
  const senderEmail = inbound ? normalizeSenderEmail(inbound.senderEmail) : null;

  const deterministicMatches = await evaluateDeterministicInboxFilters(
    toDeterministicThread(thread),
  );

  const entityHints = await resolveEntityHints({
    organizationId: thread.organizationId,
    senderEmail,
  });

  let hasPrimarySignal = false;

  if (entityHints.propertyId && entityHints.landlordLabel) {
    reasonCodes.push(BRIEFING_FILTER_REASON.MATCHED_OWNER_EMAIL);
    hasPrimarySignal = true;
  }
  if (entityHints.tenancyId) {
    reasonCodes.push(BRIEFING_FILTER_REASON.MATCHED_TENANT_EMAIL);
    hasPrimarySignal = true;
  }
  if (entityHints.prospectId) {
    reasonCodes.push(BRIEFING_FILTER_REASON.MATCHED_PROSPECT_EMAIL);
    hasPrimarySignal = true;
  }
  if (entityHints.applicationId) {
    reasonCodes.push(BRIEFING_FILTER_REASON.MATCHED_APPLICATION_EMAIL);
    hasPrimarySignal = true;
  }

  for (const match of deterministicMatches) {
    if (match.category === "STRATA") {
      reasonCodes.push(BRIEFING_FILTER_REASON.STRATA_IDENTIFIER);
      hasPrimarySignal = true;
    }
    if (match.category === "LANDLORD_COMMUNICATION") {
      reasonCodes.push(BRIEFING_FILTER_REASON.MATCHED_OWNER_EMAIL);
      hasPrimarySignal = true;
    }
    if (match.category === "TENANT_COMMUNICATION") {
      reasonCodes.push(BRIEFING_FILTER_REASON.MATCHED_TENANT_EMAIL);
      hasPrimarySignal = true;
    }
  }

  const confidentInboxCategory =
    thread.category !== "UNCATEGORIZED" &&
    thread.categoryConfidence != null &&
    thread.categoryConfidence >= INBOX_CLASSIFICATION_MIN_CONFIDENCE;

  if (confidentInboxCategory) {
    reasonCodes.push(BRIEFING_FILTER_REASON.INBOX_CATEGORY_CONFIDENT);
    hasPrimarySignal = true;
  }

  const hasKeywordSupport = PM_SUPPORT_KEYWORD_PATTERN.test(safeText);
  if (hasKeywordSupport && hasPrimarySignal) {
    reasonCodes.push(BRIEFING_FILTER_REASON.PM_KEYWORD_SUPPORT);
  }

  const include = hasPrimarySignal || (hasKeywordSupport && Boolean(entityHints.contactName));

  if (!include) {
    if (hasKeywordSupport) {
      reasonCodes.push(BRIEFING_FILTER_REASON.SKIPPED_KEYWORD_ONLY);
    } else {
      reasonCodes.push(BRIEFING_FILTER_REASON.SKIPPED_NO_PM_SIGNAL);
    }
  }

  let categorySuggestion: BriefingItemCategory | null = null;

  if (include) {
    if (entityHints.landlordLabel || deterministicMatches.some((m) => m.category === "LANDLORD_COMMUNICATION")) {
      categorySuggestion = BriefingItemCategory.LANDLORD;
    } else if (entityHints.tenancyId || deterministicMatches.some((m) => m.category === "TENANT_COMMUNICATION")) {
      categorySuggestion = BriefingItemCategory.TENANT;
    } else if (
      deterministicMatches.some((m) => m.category === "STRATA") ||
      containsStrataCorporationIdentifier(safeText)
    ) {
      categorySuggestion = BriefingItemCategory.STRATA;
    } else if (confidentInboxCategory) {
      categorySuggestion = mapEmailCategoryToBriefingCategory(thread.category);
    } else if (entityHints.prospectId || entityHints.applicationId) {
      categorySuggestion = BriefingItemCategory.GENERAL_ADMIN;
    }

    const keywordCategory = refineCategoryFromKeywords(safeText);
    if (RTB_KEYWORD_PATTERN.test(safeText)) {
      reasonCodes.push(BRIEFING_FILTER_REASON.RTB_REVIEW_NEEDED);
    }
    if (keywordCategory === BriefingItemCategory.URGENT) {
      categorySuggestion = BriefingItemCategory.URGENT;
    } else if (keywordCategory === BriefingItemCategory.RENT_DEPOSIT) {
      if (categorySuggestion == null) {
        categorySuggestion = keywordCategory;
      }
      reasonCodes.push(BRIEFING_FILTER_REASON.EMAIL_MENTION_RENT_DEPOSIT);
    } else if (keywordCategory === BriefingItemCategory.MAINTENANCE) {
      if (categorySuggestion == null) {
        categorySuggestion = keywordCategory;
      }
      reasonCodes.push(BRIEFING_FILTER_REASON.EMAIL_MENTION_MAINTENANCE);
    } else if (keywordCategory && categorySuggestion == null) {
      categorySuggestion = keywordCategory;
    }
  }

  const urgencySuggestion = include ? detectUrgencyFromText(safeText) : null;

  const priorityScore = computePriorityScore({
    include,
    urgency: urgencySuggestion,
    isUnread: thread.isUnread,
    hasEntityMatch: Boolean(
      entityHints.propertyId || entityHints.tenancyId || entityHints.prospectId || entityHints.applicationId,
    ),
    hasConfidentCategory: confidentInboxCategory,
  });

  return {
    threadId: thread.id,
    include,
    sourceType: BriefingSourceType.EMAIL,
    categorySuggestion,
    urgencySuggestion,
    reasonCodes: [...new Set(reasonCodes)],
    entityHints,
    priorityScore,
  };
}

export async function evaluateBriefingEmailFilters(
  threads: BriefingEmailThreadCandidate[],
): Promise<BriefingEmailFilterResult[]> {
  const results: BriefingEmailFilterResult[] = [];
  for (const thread of threads) {
    results.push(await evaluateBriefingEmailFilter(thread));
  }
  return results;
}
