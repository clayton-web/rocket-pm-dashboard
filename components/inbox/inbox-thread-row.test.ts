import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatInboxThreadSubject,
  formatLastMessageAtMobile,
  InboxThreadRow,
  shouldEmphasizeInboxThreadRow,
} from "@/components/inbox/inbox-thread-row";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";

function sampleRow(overrides: Partial<InboxThreadDisplayRow> = {}): InboxThreadDisplayRow {
  return {
    id: "thread_1",
    subject: "EPS2726 - Building Notice - Balcony Work Update",
    snippet: "Council approved the contractor schedule for next week.",
    lastMessageAt: "2026-06-15T21:44:57.000Z",
    isUnread: true,
    participantEmails: ["strata@building.com"],
    category: "STRATA",
    categories: ["STRATA"],
    categorySource: "RULE",
    categoryConfidence: 0.95,
    categoryAiReason: null,
    lastClassificationAttemptAt: null,
    needsClassificationReview: false,
    needsReply: true,
    unreadInbound: true,
    unlinked: false,
    reviewRequired: false,
    hasDraftReady: false,
    draftCreatedAt: null,
    badges: [],
    chips: [{ kind: "property", label: "Property · Oak Tower" }],
    actionState: "new_reply_needed",
    stakeholderLabel: "Strata",
    primaryContextLabel: "Oak Tower",
    senderLabel: "Strata Council",
    senderEmail: "strata@building.com",
    metaLine: "New reply needed · Oak Tower",
    ...overrides,
  };
}

describe("formatInboxThreadSubject", () => {
  it("returns a fallback when subject is empty", () => {
    assert.equal(formatInboxThreadSubject("  "), "(No subject)");
  });
});

describe("shouldEmphasizeInboxThreadRow", () => {
  it("emphasizes unread inbound and new reply threads", () => {
    assert.equal(shouldEmphasizeInboxThreadRow({ unreadInbound: true, actionState: "no_action" }), true);
    assert.equal(
      shouldEmphasizeInboxThreadRow({ unreadInbound: false, actionState: "new_reply_needed" }),
      true,
    );
    assert.equal(shouldEmphasizeInboxThreadRow({ unreadInbound: false, actionState: "no_action" }), false);
  });
});

describe("formatLastMessageAtMobile", () => {
  const now = new Date("2026-06-16T15:00:00.000Z");

  it("returns Today and Yesterday labels", () => {
    assert.equal(formatLastMessageAtMobile("2026-06-16T10:00:00.000Z", now), "Today");
    assert.equal(formatLastMessageAtMobile("2026-06-15T10:00:00.000Z", now), "Yesterday");
  });

  it("returns a short month/day label for older dates", () => {
    assert.equal(formatLastMessageAtMobile("2026-06-08T10:00:00.000Z", now), "Jun 8");
  });
});

describe("InboxThreadRow", () => {
  it("renders subject before sender and moves status to the meta line", () => {
    const html = renderToStaticMarkup(
      InboxThreadRow({ row: sampleRow(), mailboxId: "mailbox_1" }),
    );

    const subjectIndex = html.indexOf("EPS2726 - Building Notice - Balcony Work Update");
    const senderIndex = html.indexOf("Strata Council");
    const metaIndex = html.indexOf("New reply needed · Oak Tower");
    const snippetIndex = html.indexOf("Council approved the contractor schedule");

    assert.notEqual(subjectIndex, -1);
    assert.notEqual(senderIndex, -1);
    assert.notEqual(metaIndex, -1);
    assert.notEqual(snippetIndex, -1);
    assert.ok(subjectIndex < senderIndex);
    assert.ok(senderIndex < snippetIndex);
    assert.ok(snippetIndex < metaIndex);
    assert.doesNotMatch(html, /rounded-md border/);
  });

  it("always renders subject even when it matches the PM context label", () => {
    const html = renderToStaticMarkup(
      InboxThreadRow({
        row: sampleRow({
          subject: "Expense approval",
          primaryContextLabel: "Expense approval",
          metaLine: "Landlord",
          senderLabel: "owner@example.com",
          senderEmail: "owner@example.com",
          actionState: "no_action",
          unreadInbound: false,
        }),
        mailboxId: "mailbox_1",
      }),
    );

    assert.match(html, /Expense approval/);
    assert.match(html, /owner@example.com/);
  });

  it("renders mobile and desktop date variants", () => {
    const html = renderToStaticMarkup(
      InboxThreadRow({
        row: sampleRow({ lastMessageAt: "2026-06-15T21:44:57.000Z" }),
        mailboxId: "mailbox_1",
      }),
    );

    assert.match(html, /class="sm:hidden"/);
    assert.match(html, /class="hidden sm:inline"/);
  });
});
