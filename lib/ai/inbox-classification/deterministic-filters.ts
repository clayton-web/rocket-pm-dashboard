import type { EmailThreadCategory } from "@prisma/client";
import { extractInboundSenderFromMessages } from "@/lib/inbox/extract-thread-sender";
import { normalizeSenderEmail } from "@/lib/inbox/normalize-sender-email";

export type ThreadForDeterministicFilter = {
  subject: string | null;
  snippet: string | null;
  participantEmails: string[];
  messages: Array<{
    fromAddr: string;
    isOutbound: boolean;
    sentAt: Date;
    bodyText: string | null;
  }>;
};

export type DeterministicFilterResult =
  | { action: "none" }
  | {
      action: "classify";
      category: EmailThreadCategory;
      confidence: number;
      reason: string;
    }
  | {
      action: "skip_uncategorized";
      confidence: number;
      reason: string;
    };

const RULE_CONFIDENCE = 1;
const SKIP_CONFIDENCE = 0.95;

const STRATA_SENDER_DOMAINS = ["fsresidential.com"] as const;

const STRATA_CODE_PATTERN = /\b(?:BCS|LMS)\s*\d+[A-Z0-9-]*/i;

const TENANT_COMMUNICATION_PATTERNS = [
  /tenancy agreement/i,
  /lease agreement/i,
  /tenant signed/i,
  /tenant viewed/i,
  /has (?:viewed|signed).*(?:tenancy agreement|lease agreement)/i,
  /(?:tenancy agreement|lease agreement).*(?:viewed|signed)/i,
  /everyone has signed.*(?:tenancy agreement|lease agreement)/i,
] as const;

const RENTAL_LANGUAGE_PATTERN =
  /\b(?:rental|tenancy|tenant application|lease application|viewing request|rental inquiry|application to rent|apply (?:to|for) rent|rent the (?:unit|property|apartment))\b/i;

const SALES_OFFER_PATTERNS = [
  /\bCPS\b/,
  /contract of purchase and sale/i,
  /\b\d+(?:st|nd|rd|th)?\s+offer\b/i,
  /\boffer revised\b/i,
  /\boffer\b/i,
] as const;

const NOISE_SUBJECT_PATTERNS = [/google alert/i, /travelzoo/i, /\bnewsletter\b/i] as const;

const NOISE_SENDER_DOMAINS = ["travelzoo.com", "ca.travelzoo.com", "joepolish.com"] as const;

function collectFilterText(
  thread: Pick<ThreadForDeterministicFilter, "subject" | "snippet" | "messages">,
): string {
  const bodies = thread.messages
    .map((message) => message.bodyText)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  return [thread.subject, thread.snippet, ...bodies].filter(Boolean).join("\n");
}

function collectSenderDomains(thread: ThreadForDeterministicFilter): string[] {
  const domains = new Set<string>();

  for (const email of thread.participantEmails) {
    const normalized = normalizeSenderEmail(email);
    const domain = normalized?.split("@")[1];
    if (domain) domains.add(domain.toLowerCase());
  }

  for (const message of thread.messages) {
    const normalized = normalizeSenderEmail(message.fromAddr);
    const domain = normalized?.split("@")[1];
    if (domain) domains.add(domain.toLowerCase());
  }

  const inbound = extractInboundSenderFromMessages(thread.messages);
  if (inbound) {
    const domain = inbound.senderEmail.split("@")[1];
    if (domain) domains.add(domain.toLowerCase());
  }

  return [...domains];
}

function matchesAnyPattern(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function matchesStrataSenderDomain(domains: string[]): boolean {
  return domains.some((domain) =>
    STRATA_SENDER_DOMAINS.some(
      (known) => domain === known || domain.endsWith(`.${known}`),
    ),
  );
}

function matchesNoiseSender(domains: string[], text: string): boolean {
  if (matchesAnyPattern(text, NOISE_SUBJECT_PATTERNS)) return true;

  return domains.some((domain) =>
    NOISE_SENDER_DOMAINS.some((known) => domain === known || domain.endsWith(`.${known}`)),
  );
}

export function containsStrataCorporationIdentifier(text: string): boolean {
  return STRATA_CODE_PATTERN.test(text);
}

export function threadHasStrataCorporationIdentifier(
  thread: Pick<ThreadForDeterministicFilter, "subject" | "snippet" | "messages">,
): boolean {
  return containsStrataCorporationIdentifier(collectFilterText(thread));
}

function matchesStrataSignals(text: string, domains: string[]): boolean {
  if (containsStrataCorporationIdentifier(text)) return true;
  return matchesStrataSenderDomain(domains);
}

function matchesTenantCommunication(text: string): boolean {
  return matchesAnyPattern(text, TENANT_COMMUNICATION_PATTERNS);
}

function matchesRealEstateSalesOffer(text: string): boolean {
  if (RENTAL_LANGUAGE_PATTERN.test(text)) return false;
  return matchesAnyPattern(text, SALES_OFFER_PATTERNS);
}

/** Deterministic inbox rules applied before Gemini. Manual categories are handled upstream. */
export function evaluateDeterministicInboxFilters(
  thread: ThreadForDeterministicFilter,
): DeterministicFilterResult {
  const text = collectFilterText(thread);
  const domains = collectSenderDomains(thread);

  if (matchesTenantCommunication(text)) {
    return {
      action: "classify",
      category: "TENANT_COMMUNICATION",
      confidence: RULE_CONFIDENCE,
      reason:
        "Matched tenancy/lease agreement language (HelloSign/DocuSign workflow or tenant signed/viewed).",
    };
  }

  if (matchesStrataSignals(text, domains)) {
    return {
      action: "classify",
      category: "STRATA",
      confidence: RULE_CONFIDENCE,
      reason:
        "Matched strata code (BCS/LMS), forwarded building notice, or known strata sender domain.",
    };
  }

  if (matchesRealEstateSalesOffer(text)) {
    return {
      action: "skip_uncategorized",
      confidence: SKIP_CONFIDENCE,
      reason:
        "Matched real estate sales/offer language without rental or tenancy context; left uncategorized.",
    };
  }

  if (matchesNoiseSender(domains, text)) {
    return {
      action: "skip_uncategorized",
      confidence: SKIP_CONFIDENCE,
      reason:
        "Matched newsletter/alert/marketing sender or subject; left uncategorized without Gemini.",
    };
  }

  return { action: "none" };
}
