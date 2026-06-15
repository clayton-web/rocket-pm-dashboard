import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";
import {
  buildStakeholderBinSections,
  computeInboxSummary,
  filterClassificationReview,
  filterNeedsReply,
  filterNeedsReplyInStakeholderBin,
  isInboxQueueParam,
  sortNeedsReplyByStakeholderThenAge,
} from "./inbox-thread-queues";

function row(
  overrides: Partial<InboxThreadDisplayRow> & Pick<InboxThreadDisplayRow, "id">,
): InboxThreadDisplayRow {
  return {
    subject: "Test",
    snippet: null,
    lastMessageAt: "2026-06-09T12:00:00.000Z",
    isUnread: false,
    participantEmails: [],
    category: "UNCATEGORIZED",
    categories: ["UNCATEGORIZED"],
    categorySource: null,
    categoryConfidence: null,
    categoryAiReason: null,
    lastClassificationAttemptAt: null,
    needsClassificationReview: false,
    needsReply: false,
    unreadInbound: false,
    unlinked: true,
    reviewRequired: false,
    hasDraftReady: false,
    draftCreatedAt: null,
    badges: [],
    chips: [],
    actionState: "no_action",
    stakeholderLabel: "Unsorted",
    primaryContextLabel: "Test",
    ...overrides,
  };
}

describe("inbox-thread-queues", () => {
  it("accepts classification_review queue param", () => {
    assert.equal(isInboxQueueParam("classification_review"), true);
    assert.equal(isInboxQueueParam("needs_review"), true);
    assert.equal(isInboxQueueParam("invalid"), false);
  });

  it("filters classification review threads by display flag", () => {
    const rows = [
      row({
        id: "1",
        needsClassificationReview: true,
        lastClassificationAttemptAt: "2026-06-09T10:00:00.000Z",
      }),
      row({ id: "2", needsClassificationReview: false }),
      row({
        id: "3",
        needsClassificationReview: true,
        lastClassificationAttemptAt: "2026-06-09T14:00:00.000Z",
      }),
    ];

    const filtered = filterClassificationReview(rows);
    assert.deepEqual(filtered.map((item) => item.id), ["3", "1"]);
  });

  it("includes classification review count from db total in summary", () => {
    const summary = computeInboxSummary(
      [
        row({ id: "1", needsClassificationReview: true }),
        row({ id: "2", reviewRequired: true }),
      ],
      0,
      7,
    );

    assert.equal(summary.classificationReview, 7);
    assert.equal(summary.reviewRequired, 1);
    assert.equal(summary.totalUnique, 2);
  });

  it("sorts needs reply by stakeholder priority then oldest waiting first", () => {
    const rows = sortNeedsReplyByStakeholderThenAge([
      row({
        id: "tenant-new",
        needsReply: true,
        categories: ["TENANT_COMMUNICATION"],
        lastMessageAt: "2026-06-09T14:00:00.000Z",
      }),
      row({
        id: "landlord-old",
        needsReply: true,
        categories: ["LANDLORD_COMMUNICATION"],
        lastMessageAt: "2026-06-09T08:00:00.000Z",
      }),
      row({
        id: "landlord-new",
        needsReply: true,
        categories: ["LANDLORD_COMMUNICATION"],
        lastMessageAt: "2026-06-09T16:00:00.000Z",
      }),
      row({
        id: "unsorted",
        needsReply: true,
        categories: ["UNCATEGORIZED"],
        lastMessageAt: "2026-06-09T06:00:00.000Z",
      }),
    ]);

    assert.deepEqual(rows.map((entry) => entry.id), [
      "landlord-old",
      "landlord-new",
      "tenant-new",
      "unsorted",
    ]);
  });

  it("uses highest-priority category when sorting multi-category threads", () => {
    const sorted = filterNeedsReply([
      row({
        id: "tenant-strata",
        needsReply: true,
        categories: ["TENANT_COMMUNICATION", "STRATA"],
        lastMessageAt: "2026-06-09T10:00:00.000Z",
      }),
      row({
        id: "landlord",
        needsReply: true,
        categories: ["LANDLORD_COMMUNICATION"],
        lastMessageAt: "2026-06-09T12:00:00.000Z",
      }),
    ]);

    assert.deepEqual(sorted.map((entry) => entry.id), ["landlord", "tenant-strata"]);
  });

  it("filters landlord, tenant, and strata bins to needs-reply threads only", () => {
    const rows = [
      row({
        id: "landlord-waiting",
        needsReply: true,
        categories: ["LANDLORD_COMMUNICATION"],
      }),
      row({
        id: "landlord-handled",
        needsReply: false,
        categories: ["LANDLORD_COMMUNICATION"],
      }),
      row({
        id: "tenant-waiting",
        needsReply: true,
        categories: ["TENANT_COMMUNICATION"],
      }),
    ];

    assert.deepEqual(
      filterNeedsReplyInStakeholderBin(rows, "LANDLORD_COMMUNICATION").map((entry) => entry.id),
      ["landlord-waiting"],
    );
    assert.deepEqual(
      filterNeedsReplyInStakeholderBin(rows, "TENANT_COMMUNICATION").map((entry) => entry.id),
      ["tenant-waiting"],
    );
    assert.deepEqual(filterNeedsReplyInStakeholderBin(rows, "STRATA"), []);
  });

  it("includes all unsorted threads in the unsorted bin", () => {
    const rows = [
      row({
        id: "unsorted-waiting",
        needsReply: true,
        categories: ["UNCATEGORIZED"],
      }),
      row({
        id: "unsorted-handled",
        needsReply: false,
        categories: ["UNCATEGORIZED"],
      }),
    ];

    assert.deepEqual(
      filterNeedsReplyInStakeholderBin(rows, "UNCATEGORIZED").map((entry) => entry.id).sort(),
      ["unsorted-handled", "unsorted-waiting"],
    );
  });

  it("includes multi-category threads in every matching stakeholder bin", () => {
    const rows = [
      row({
        id: "tenant-strata",
        needsReply: true,
        categories: ["TENANT_COMMUNICATION", "STRATA"],
      }),
    ];

    assert.deepEqual(
      filterNeedsReplyInStakeholderBin(rows, "TENANT_COMMUNICATION").map((entry) => entry.id),
      ["tenant-strata"],
    );
    assert.deepEqual(
      filterNeedsReplyInStakeholderBin(rows, "STRATA").map((entry) => entry.id),
      ["tenant-strata"],
    );
    assert.deepEqual(filterNeedsReplyInStakeholderBin(rows, "LANDLORD_COMMUNICATION"), []);
  });

  it("builds all four stakeholder bins in order even when empty", () => {
    const bins = buildStakeholderBinSections({
      rows: [],
      crateActionCounts: {
        LANDLORD_COMMUNICATION: 0,
        TENANT_COMMUNICATION: 0,
        STRATA: 0,
        TENANT_INQUIRY: 0,
        UNCATEGORIZED: 0,
        all: 0,
      },
      crateCounts: {
        LANDLORD_COMMUNICATION: 0,
        TENANT_COMMUNICATION: 0,
        STRATA: 0,
        TENANT_INQUIRY: 0,
        UNCATEGORIZED: 0,
        all: 0,
      },
    });

    assert.equal(bins.length, 4);
    assert.deepEqual(
      bins.map((bin) => bin.category),
      ["LANDLORD_COMMUNICATION", "TENANT_COMMUNICATION", "STRATA", "UNCATEGORIZED"],
    );
    assert.deepEqual(
      bins.map((bin) => bin.title),
      ["Landlord Communication", "Tenant Communication", "Strata", "Unsorted"],
    );
    assert.ok(bins.every((bin) => bin.preview.length === 0));
    assert.equal(bins[0]?.emptyMessage, "No landlord threads waiting for a reply.");
    assert.equal(bins[3]?.emptyMessage, "No unsorted threads.");
    assert.equal(bins[3]?.variant, "cleanup");
  });

  it("uses needs-reply totals for primary bins and unsorted total for cleanup bin", () => {
    const bins = buildStakeholderBinSections({
      rows: [
        row({
          id: "landlord",
          needsReply: true,
          categories: ["LANDLORD_COMMUNICATION"],
        }),
        row({
          id: "unsorted",
          needsReply: false,
          categories: ["UNCATEGORIZED"],
        }),
      ],
      crateActionCounts: {
        LANDLORD_COMMUNICATION: 1,
        TENANT_COMMUNICATION: 0,
        STRATA: 0,
        TENANT_INQUIRY: 0,
        UNCATEGORIZED: 0,
        all: 2,
      },
      crateCounts: {
        LANDLORD_COMMUNICATION: 1,
        TENANT_COMMUNICATION: 0,
        STRATA: 0,
        TENANT_INQUIRY: 0,
        UNCATEGORIZED: 3,
        all: 3,
      },
    });

    assert.equal(bins[0]?.total, 1);
    assert.equal(bins[0]?.preview[0]?.id, "landlord");
    assert.equal(bins[3]?.total, 3);
    assert.equal(bins[3]?.preview[0]?.id, "unsorted");
  });
});
