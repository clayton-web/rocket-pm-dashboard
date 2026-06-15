import type { EmailThreadCategory } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { extractInboundSenderFromMessages } from "@/lib/inbox/extract-thread-sender";
import { normalizeSenderEmail } from "@/lib/inbox/normalize-sender-email";

export type ThreadForDeterministicFilter = {
  organizationId: string;
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

export type DeterministicCategoryMatch = {
  category: EmailThreadCategory;
  confidence: number;
  reason: string;
};

const RULE_CONFIDENCE = 1;

const STRATA_CODE_PATTERN = /\b(?:BCS|EPS|LMS)\s*\d+[A-Z0-9-]*/i;

function collectFilterText(
  thread: Pick<ThreadForDeterministicFilter, "subject" | "snippet" | "messages">,
): string {
  const bodies = thread.messages
    .map((message) => message.bodyText)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  return [thread.subject, thread.snippet, ...bodies].filter(Boolean).join("\n");
}

export function containsStrataCorporationIdentifier(text: string): boolean {
  return STRATA_CODE_PATTERN.test(text);
}

export function threadHasStrataCorporationIdentifier(
  thread: Pick<ThreadForDeterministicFilter, "subject" | "snippet" | "messages">,
): boolean {
  return containsStrataCorporationIdentifier(collectFilterText(thread));
}

async function resolveInboundSenderEmail(
  thread: ThreadForDeterministicFilter,
): Promise<string | null> {
  const inbound = extractInboundSenderFromMessages(thread.messages);
  if (!inbound) return null;
  return normalizeSenderEmail(inbound.senderEmail);
}

async function matchOwnerEmail(
  organizationId: string,
  senderEmail: string,
): Promise<DeterministicCategoryMatch | null> {
  const property = await prisma.property.findFirst({
    where: {
      organizationId,
      ownerEmail: {
        equals: senderEmail,
        mode: "insensitive",
      },
    },
    select: { id: true, name: true },
  });

  if (!property) return null;

  return {
    category: "LANDLORD_COMMUNICATION",
    confidence: RULE_CONFIDENCE,
    reason: `Sender email matched Property.ownerEmail for ${property.name}.`,
  };
}

async function matchTenantEmail(
  organizationId: string,
  senderEmail: string,
): Promise<DeterministicCategoryMatch | null> {
  const contact = await prisma.tenancyContact.findFirst({
    where: {
      email: {
        equals: senderEmail,
        mode: "insensitive",
      },
      tenancy: {
        unit: {
          property: {
            organizationId,
          },
        },
      },
    },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (!contact) return null;

  return {
    category: "TENANT_COMMUNICATION",
    confidence: RULE_CONFIDENCE,
    reason: `Sender email matched TenancyContact.email for ${contact.firstName} ${contact.lastName}.`.trim(),
  };
}

function matchStrataIdentifier(
  thread: Pick<ThreadForDeterministicFilter, "subject" | "snippet" | "messages">,
): DeterministicCategoryMatch | null {
  const text = collectFilterText(thread);
  const match = text.match(STRATA_CODE_PATTERN);
  if (!match) return null;

  return {
    category: "STRATA",
    confidence: RULE_CONFIDENCE,
    reason: `Matched strata corporation identifier ${match[0].replace(/\s+/g, "")}.`,
  };
}

/** Deterministic inbox rules applied before Gemini. Returns all matching categories. */
export async function evaluateDeterministicInboxFilters(
  thread: ThreadForDeterministicFilter,
): Promise<DeterministicCategoryMatch[]> {
  const matches: DeterministicCategoryMatch[] = [];
  const seen = new Set<EmailThreadCategory>();

  const senderEmail = await resolveInboundSenderEmail(thread);
  if (senderEmail) {
    const ownerMatch = await matchOwnerEmail(thread.organizationId, senderEmail);
    if (ownerMatch && !seen.has(ownerMatch.category)) {
      matches.push(ownerMatch);
      seen.add(ownerMatch.category);
    }

    const tenantMatch = await matchTenantEmail(thread.organizationId, senderEmail);
    if (tenantMatch && !seen.has(tenantMatch.category)) {
      matches.push(tenantMatch);
      seen.add(tenantMatch.category);
    }
  }

  const strataMatch = matchStrataIdentifier(thread);
  if (strataMatch && !seen.has(strataMatch.category)) {
    matches.push(strataMatch);
  }

  return matches;
}
