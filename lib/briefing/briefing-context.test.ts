import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingItemCategory, BriefingItemUrgency, BriefingSlot, BriefingSourceType } from "@prisma/client";
import { buildBriefingContext } from "@/lib/briefing/briefing-context";
import {
  BRIEFING_MAX_SUBJECT_CHARS,
  BRIEFING_MAX_THREADS_IN_CONTEXT,
  type BriefingEmailFilterResult,
  type BriefingEmailThreadCandidate,
} from "@/lib/briefing/briefing-types";
import { BRIEFING_FILTER_REASON } from "@/lib/briefing/briefing-filters";

function candidate(
  id: string,
  overrides: Partial<BriefingEmailThreadCandidate> = {},
): BriefingEmailThreadCandidate {
  return {
    id,
    organizationId: "org_test",
    providerThreadId: `provider_${id}`,
    subject: overrides.subject ?? `Subject ${id}`,
    snippet: overrides.snippet ?? `Snippet ${id}`,
    category: overrides.category ?? "UNCATEGORIZED",
    categoryConfidence: overrides.categoryConfidence ?? null,
    participantEmails: overrides.participantEmails ?? [`sender-${id}@example.com`],
    lastMessageAt: overrides.lastMessageAt ?? new Date("2026-06-26T12:00:00.000Z"),
    isUnread: overrides.isUnread ?? false,
    messages: overrides.messages ?? [
      {
        id: `msg_${id}`,
        providerMessageId: `provider_msg_${id}`,
        fromAddr: `sender-${id}@example.com`,
        isOutbound: false,
        sentAt: new Date("2026-06-26T12:00:00.000Z"),
        bodyText: "This raw body must never appear in context output.",
      },
    ],
  };
}

function includedFilter(
  threadId: string,
  priorityScore: number,
): BriefingEmailFilterResult {
  return {
    threadId,
    include: true,
    sourceType: BriefingSourceType.EMAIL,
    categorySuggestion: BriefingItemCategory.TENANT,
    urgencySuggestion: BriefingItemUrgency.NORMAL,
    reasonCodes: [BRIEFING_FILTER_REASON.MATCHED_TENANT_EMAIL],
    entityHints: { contactName: "Alex Tenant" },
    priorityScore,
  };
}

function skippedFilter(threadId: string): BriefingEmailFilterResult {
  return {
    threadId,
    include: false,
    sourceType: BriefingSourceType.EMAIL,
    categorySuggestion: null,
    urgencySuggestion: null,
    reasonCodes: [BRIEFING_FILTER_REASON.SKIPPED_NO_PM_SIGNAL],
    entityHints: {},
    priorityScore: 0,
  };
}

describe("buildBriefingContext", () => {
  const baseInput = {
    organization: { id: "org_test", name: "Axford PM" },
    settings: {
      lookbackHours: 12,
      timezone: "America/Vancouver",
      morningLocalTime: "07:00",
      afternoonLocalTime: "14:00",
      activeSourceTypes: [BriefingSourceType.EMAIL],
    },
    slot: BriefingSlot.MORNING,
    window: {
      windowStart: new Date("2026-06-26T07:00:00.000Z"),
      windowEnd: new Date("2026-06-26T14:00:00.000Z"),
    },
  };

  it("includes only filtered threads and excludes raw bodies", () => {
    const candidates = [candidate("t1"), candidate("t2")];
    const filterResults = [includedFilter("t1", 50), skippedFilter("t2")];

    const context = buildBriefingContext({
      ...baseInput,
      candidates,
      filterResults,
    });

    assert.equal(context.counts.scanned, 2);
    assert.equal(context.counts.included, 1);
    assert.equal(context.counts.skipped, 1);
    assert.equal(context.threads.length, 1);
    assert.equal(context.threads[0]?.threadId, "t1");
    assert.equal(context.threads[0]?.dataProvenance, "EMAIL_MENTION");
    assert.deepEqual(context.activeSourceTypes, [BriefingSourceType.EMAIL]);
    assert.ok(context.scopeNote.includes("Buildium"));

    const serialized = JSON.stringify(context);
    assert.ok(!serialized.includes("This raw body must never appear"));
  });

  it("truncates long subjects", () => {
    const longSubject = "S".repeat(BRIEFING_MAX_SUBJECT_CHARS + 50);
    const candidates = [candidate("t1", { subject: longSubject })];
    const filterResults = [includedFilter("t1", 50)];

    const context = buildBriefingContext({
      ...baseInput,
      candidates,
      filterResults,
    });

    const subject = context.threads[0]?.subject;
    assert.ok(subject);
    assert.ok(subject.length <= BRIEFING_MAX_SUBJECT_CHARS);
    assert.ok(subject.endsWith("…"));
  });

  it("sorts higher priority threads first", () => {
    const candidates = [
      candidate("low", { subject: "a", snippet: "b" }),
      candidate("high", { subject: "c", snippet: "d" }),
      candidate("mid", { subject: "e", snippet: "f" }),
    ];
    const filterResults = [
      includedFilter("low", 10),
      includedFilter("high", 90),
      includedFilter("mid", 50),
    ];

    const context = buildBriefingContext({
      ...baseInput,
      candidates,
      filterResults,
    });

    assert.deepEqual(
      context.threads.map((thread) => thread.threadId),
      ["high", "mid", "low"],
    );
  });

  it("never exceeds BRIEFING_MAX_THREADS_IN_CONTEXT", () => {
    const candidates = Array.from({ length: BRIEFING_MAX_THREADS_IN_CONTEXT + 5 }, (_, index) =>
      candidate(`t${index}`, { subject: "S", snippet: "n" }),
    );
    const filterResults = candidates.map((item, index) =>
      includedFilter(item.id, index),
    );

    const context = buildBriefingContext({
      ...baseInput,
      candidates,
      filterResults,
    });

    assert.ok(context.threads.length <= BRIEFING_MAX_THREADS_IN_CONTEXT);
    assert.equal(context.threads.length, context.counts.included);
  });

  it("records whether the latest message is inbound", () => {
    const inboundThread = candidate("inbound");
    const outboundThread = candidate("outbound", {
      messages: [
        {
          id: "msg_out",
          providerMessageId: "provider_msg_out",
          fromAddr: "staff@example.com",
          isOutbound: true,
          sentAt: new Date("2026-06-26T13:00:00.000Z"),
          bodyText: null,
        },
        {
          id: "msg_in",
          providerMessageId: "provider_msg_in",
          fromAddr: "tenant@example.com",
          isOutbound: false,
          sentAt: new Date("2026-06-26T12:00:00.000Z"),
          bodyText: null,
        },
      ],
    });

    const context = buildBriefingContext({
      ...baseInput,
      candidates: [inboundThread, outboundThread],
      filterResults: [includedFilter("inbound", 10), includedFilter("outbound", 20)],
    });

    const inbound = context.threads.find((thread) => thread.threadId === "inbound");
    const outbound = context.threads.find((thread) => thread.threadId === "outbound");
    assert.equal(inbound?.latestMessageIsInbound, true);
    assert.equal(outbound?.latestMessageIsInbound, false);
  });
});
