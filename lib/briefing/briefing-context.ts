import type { BriefingSlot } from "@prisma/client";
import {
  BRIEFING_MAX_CONTEXT_CHARS,
  BRIEFING_MAX_EXCERPT_CHARS,
  BRIEFING_MAX_SNIPPET_CHARS,
  BRIEFING_MAX_SUBJECT_CHARS,
  BRIEFING_MAX_THREADS_IN_CONTEXT,
  BRIEFING_PROMPT_VERSION,
  type BriefingContext,
  type BriefingContextThreadItem,
  type BriefingEmailFilterResult,
  type BriefingEmailThreadCandidate,
  type BriefingOrgSnapshot,
  type BriefingSettingsSnapshot,
  type BriefingWindow,
} from "@/lib/briefing/briefing-types";
import { deriveInboxSenderDisplay } from "@/lib/inbox/extract-thread-sender";
import {
  BRIEFING_DATA_PROVENANCE,
  BRIEFING_MVP_ACTIVE_SOURCE_TYPES,
  BRIEFING_MVP_SCOPE_NOTE,
} from "@/lib/briefing/briefing-sources";

function truncateText(value: string | null | undefined, maxChars: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

function buildSafeExcerpt(thread: BriefingEmailThreadCandidate): string | null {
  const snippet = truncateText(thread.snippet, BRIEFING_MAX_SNIPPET_CHARS);
  if (snippet) return snippet;
  return null;
}

function resolveNewestInboundMessage(thread: BriefingEmailThreadCandidate) {
  const inbound = thread.messages
    .filter((message) => !message.isOutbound)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  return inbound[0] ?? null;
}

function buildContextThreadItem(args: {
  thread: BriefingEmailThreadCandidate;
  filter: BriefingEmailFilterResult;
}): BriefingContextThreadItem {
  const newestInbound = resolveNewestInboundMessage(args.thread);
  const senderDisplay = deriveInboxSenderDisplay({
    latestInboundFromAddr: newestInbound?.fromAddr ?? null,
    participantEmails: args.thread.participantEmails,
  });

  return {
    threadId: args.thread.id,
    newestMessageId: newestInbound?.id ?? null,
    providerThreadId: args.thread.providerThreadId,
    providerMessageId: newestInbound?.providerMessageId ?? null,
    sender: senderDisplay.senderLabel,
    senderEmail: senderDisplay.senderEmail,
    subject: truncateText(args.thread.subject, BRIEFING_MAX_SUBJECT_CHARS),
    excerpt: truncateText(buildSafeExcerpt(args.thread), BRIEFING_MAX_EXCERPT_CHARS),
    categoryHint: args.filter.categorySuggestion,
    urgencyHint: args.filter.urgencySuggestion,
    entityHints: args.filter.entityHints,
    reasonCodes: args.filter.reasonCodes,
    dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
    lastMessageAt: args.thread.lastMessageAt?.toISOString() ?? null,
    isUnread: args.thread.isUnread,
  };
}

function sortIncludedPairs(
  pairs: Array<{ thread: BriefingEmailThreadCandidate; filter: BriefingEmailFilterResult }>,
): Array<{ thread: BriefingEmailThreadCandidate; filter: BriefingEmailFilterResult }> {
  return [...pairs].sort((a, b) => {
    const scoreDiff = b.filter.priorityScore - a.filter.priorityScore;
    if (scoreDiff !== 0) return scoreDiff;

    const aTime = a.thread.lastMessageAt?.getTime() ?? 0;
    const bTime = b.thread.lastMessageAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

function enforceContextSizeLimit(context: BriefingContext): BriefingContext {
  const serialized = JSON.stringify(context);
  if (serialized.length <= BRIEFING_MAX_CONTEXT_CHARS) {
    return context;
  }

  const threads = [...context.threads];
  while (threads.length > 1 && JSON.stringify({ ...context, threads }).length > BRIEFING_MAX_CONTEXT_CHARS) {
    threads.pop();
  }

  return {
    ...context,
    threads,
    counts: {
      ...context.counts,
      included: threads.length,
      skipped: context.counts.scanned - threads.length,
    },
  };
}

export type BuildBriefingContextInput = {
  organization: BriefingOrgSnapshot;
  settings: BriefingSettingsSnapshot;
  slot: BriefingSlot;
  window: BriefingWindow;
  candidates: BriefingEmailThreadCandidate[];
  filterResults: BriefingEmailFilterResult[];
};

/**
 * Builds a compact, privacy-conscious context payload for Gemini.
 * Uses snippet/subject only — never raw email bodies.
 */
export function buildBriefingContext(input: BuildBriefingContextInput): BriefingContext {
  const filterByThreadId = new Map(input.filterResults.map((result) => [result.threadId, result]));

  const pairs = input.candidates
    .map((thread) => {
      const filter = filterByThreadId.get(thread.id);
      if (!filter) {
        throw new Error(`Missing filter result for thread ${thread.id}`);
      }
      return { thread, filter };
    })
    .filter((pair) => pair.filter.include);

  const sortedPairs = sortIncludedPairs(pairs).slice(0, BRIEFING_MAX_THREADS_IN_CONTEXT);

  const includedThreads = sortedPairs.map(({ thread, filter }) =>
    buildContextThreadItem({ thread, filter }),
  );

  const scanned = input.candidates.length;
  const included = includedThreads.length;
  const skipped = scanned - input.filterResults.filter((result) => result.include).length;

  const activeSourceTypes =
    input.settings.activeSourceTypes.length > 0
      ? input.settings.activeSourceTypes.filter((sourceType) =>
          BRIEFING_MVP_ACTIVE_SOURCE_TYPES.includes(sourceType),
        )
      : [...BRIEFING_MVP_ACTIVE_SOURCE_TYPES];

  const context: BriefingContext = {
    promptVersion: BRIEFING_PROMPT_VERSION,
    organization: input.organization,
    slot: input.slot,
    window: {
      start: input.window.windowStart.toISOString(),
      end: input.window.windowEnd.toISOString(),
    },
    activeSourceTypes,
    scopeNote: BRIEFING_MVP_SCOPE_NOTE,
    counts: {
      scanned,
      included,
      skipped,
    },
    threads: includedThreads,
  };

  return enforceContextSizeLimit(context);
}
