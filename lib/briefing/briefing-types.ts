import type {
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingSlot,
  BriefingSourceType,
  EmailThreadCategory,
} from "@prisma/client";
import type { BriefingDataProvenance } from "@/lib/briefing/briefing-sources";
import { BRIEFING_MVP_SCOPE_NOTE } from "@/lib/briefing/briefing-sources";

/** Max hours for first-run / fallback lookback window. */
export const BRIEFING_MAX_LOOKBACK_HOURS = 48;

/** Default lookback when no prior completed run exists. */
export const BRIEFING_DEFAULT_LOOKBACK_HOURS = 12;

/** Max threads included in a single Gemini context payload. */
export const BRIEFING_MAX_THREADS_IN_CONTEXT = 30;

/** Max total characters in serialized briefing context JSON sent to Gemini. */
export const BRIEFING_MAX_CONTEXT_CHARS = 12_000;

export const BRIEFING_MAX_SUBJECT_CHARS = 200;
export const BRIEFING_MAX_SNIPPET_CHARS = 300;
export const BRIEFING_MAX_EXCERPT_CHARS = 500;

export const BRIEFING_PROMPT_VERSION = "daily-briefing-v1";

export type BriefingWindow = {
  windowStart: Date;
  windowEnd: Date;
};

export type BriefingSettingsSnapshot = {
  lookbackHours: number;
  timezone: string;
  morningLocalTime: string;
  afternoonLocalTime: string;
  activeSourceTypes: BriefingSourceType[];
};

export type BriefingOrgSnapshot = {
  id: string;
  name: string;
};

export type BriefingEmailMessageSnapshot = {
  id: string;
  providerMessageId: string;
  fromAddr: string;
  isOutbound: boolean;
  sentAt: Date;
  /** Used internally for filtering only; never included in briefing context output. */
  bodyText: string | null;
};

/** Already-synced email thread candidate for briefing pipeline. */
export type BriefingEmailThreadCandidate = {
  id: string;
  organizationId: string;
  providerThreadId: string;
  subject: string | null;
  snippet: string | null;
  category: EmailThreadCategory;
  categoryConfidence: number | null;
  participantEmails: string[];
  lastMessageAt: Date | null;
  isUnread: boolean;
  messages: BriefingEmailMessageSnapshot[];
};

export type BriefingEntityHints = {
  propertyId?: string;
  propertyName?: string;
  unitLabel?: string;
  tenancyId?: string;
  contactName?: string;
  prospectId?: string;
  applicationId?: string;
  landlordLabel?: string;
};

export type BriefingEmailFilterResult = {
  threadId: string;
  include: boolean;
  sourceType: BriefingSourceType;
  categorySuggestion: BriefingItemCategory | null;
  urgencySuggestion: BriefingItemUrgency | null;
  reasonCodes: string[];
  entityHints: BriefingEntityHints;
  /** Higher = prioritize in context ordering. */
  priorityScore: number;
};

export type BriefingContextThreadItem = {
  threadId: string;
  newestMessageId: string | null;
  providerThreadId: string;
  providerMessageId: string | null;
  sender: string;
  senderEmail: string | null;
  subject: string | null;
  excerpt: string | null;
  categoryHint: BriefingItemCategory | null;
  urgencyHint: BriefingItemUrgency | null;
  entityHints: BriefingEntityHints;
  reasonCodes: string[];
  /** MVP: always EMAIL_MENTION — not accounting/ledger data. */
  dataProvenance: BriefingDataProvenance;
  lastMessageAt: string | null;
  isUnread: boolean;
};

export type BriefingContext = {
  promptVersion: string;
  organization: BriefingOrgSnapshot;
  slot: BriefingSlot;
  window: {
    start: string;
    end: string;
  };
  /** Active sources for this run (MVP: EMAIL only). */
  activeSourceTypes: BriefingSourceType[];
  /** Human-readable scope guard for Gemini and staff review. */
  scopeNote: string;
  counts: {
    scanned: number;
    included: number;
    skipped: number;
  };
  threads: BriefingContextThreadItem[];
};

export { BRIEFING_MVP_SCOPE_NOTE };
