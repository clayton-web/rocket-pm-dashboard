import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOperationsCentreFromDrafts,
  resolveSectionViewAllHref,
  sortOperationalWorkItems,
  type OperationsSourceError,
} from "./operations-centre.service";
import type { OperationalWorkItem, OperationalWorkItemDraft } from "./work-item";
import { OPERATIONS_PREVIEW_LIMIT } from "./work-item";

function draft(
  key: string,
  sectionSignals: OperationalWorkItemDraft["signals"],
  overrides: Partial<OperationalWorkItemDraft> = {},
): OperationalWorkItemDraft {
  return {
    key,
    recordType: "prospect",
    recordId: key,
    title: key,
    subtitle: null,
    propertyLabel: "Prop",
    unitLabel: null,
    statusLabel: "Status",
    nextActionLabel: "Act",
    href: "/leasing/prospects/x",
    viewAllHref: "/leasing/prospects",
    workflowBadge: "Test",
    dueAt: null,
    waitingOn: "staff",
    assignedToLabel: null,
    urgency: "normal",
    secondaryIndicators: [],
    signals: sectionSignals,
    ...overrides,
  };
}

function item(
  overrides: Partial<OperationalWorkItem> & Pick<OperationalWorkItem, "key" | "title" | "urgency">,
): OperationalWorkItem {
  return {
    key: overrides.key,
    recordType: "prospect",
    recordId: overrides.key,
    title: overrides.title,
    subtitle: null,
    propertyLabel: "Prop",
    unitLabel: null,
    statusLabel: "Status",
    nextActionLabel: "Act",
    href: "/leasing/prospects/x",
    viewAllHref: overrides.viewAllHref ?? "/leasing/prospects",
    workflowBadge: "Test",
    dueAt: overrides.dueAt ?? null,
    waitingOn: "staff",
    assignedToLabel: null,
    urgency: overrides.urgency,
    secondaryIndicators: [],
    primarySection: overrides.primarySection ?? "needs_attention",
    isOverdue: overrides.isOverdue ?? false,
  };
}

describe("buildOperationsCentreFromDrafts", () => {
  it("groups by primary section and caps previews", () => {
    const many = Array.from({ length: OPERATIONS_PREVIEW_LIMIT + 3 }, (_, i) =>
      draft(`needs-${i}`, {
        requiresStaffAction: true,
        isOverdue: false,
        isWaitingOnOther: false,
        isComingUp: false,
      }),
    );
    const data = buildOperationsCentreFromDrafts([
      ...many,
      draft("wait-1", {
        requiresStaffAction: false,
        isOverdue: false,
        isWaitingOnOther: true,
        isComingUp: false,
      }),
    ]);
    assert.equal(data.summary.needs_attention, OPERATIONS_PREVIEW_LIMIT + 3);
    assert.equal(data.summary.waiting, 1);
    assert.equal(data.summary.total, OPERATIONS_PREVIEW_LIMIT + 4);
    const needs = data.sections.find((s) => s.id === "needs_attention");
    assert.ok(needs);
    assert.equal(needs.preview.length, OPERATIONS_PREVIEW_LIMIT);
    assert.equal(needs.total, OPERATIONS_PREVIEW_LIMIT + 3);
  });

  it("surfaces source errors without dropping other drafts", () => {
    const errors: OperationsSourceError[] = [
      { sourceId: "onboarding", message: "Onboarding: boom" },
    ];
    const data = buildOperationsCentreFromDrafts(
      [
        draft("ok", {
          requiresStaffAction: true,
          isOverdue: false,
          isWaitingOnOther: false,
          isComingUp: false,
        }),
      ],
      errors,
    );
    assert.equal(data.sourceErrors.length, 1);
    assert.equal(data.summary.total, 1);
  });

  it("surfaces maintenance source errors while keeping leasing drafts", () => {
    const data = buildOperationsCentreFromDrafts(
      [
        draft("lease-1", {
          requiresStaffAction: true,
          isOverdue: false,
          isWaitingOnOther: false,
          isComingUp: false,
        }),
      ],
      [{ sourceId: "maintenance", message: "Maintenance: boom" }],
    );
    assert.equal(data.summary.total, 1);
    assert.equal(data.sourceErrors[0]?.sourceId, "maintenance");
  });

  it("excludes ineligible drafts", () => {
    const data = buildOperationsCentreFromDrafts([
      draft("noop", {
        requiresStaffAction: false,
        isOverdue: false,
        isWaitingOnOther: false,
        isComingUp: false,
      }),
    ]);
    assert.equal(data.summary.total, 0);
  });

  it("omits viewAllHref for mixed-domain sections", () => {
    const data = buildOperationsCentreFromDrafts([
      draft(
        "lease",
        {
          requiresStaffAction: true,
          isOverdue: false,
          isWaitingOnOther: false,
          isComingUp: false,
        },
        { viewAllHref: "/leasing/prospects", title: "Lease item" },
      ),
      draft(
        "maint",
        {
          requiresStaffAction: true,
          isOverdue: false,
          isWaitingOnOther: false,
          isComingUp: false,
        },
        {
          recordType: "maintenance",
          viewAllHref: "/maintenance",
          title: "Maint item",
          urgency: "low",
        },
      ),
    ]);
    const needs = data.sections.find((s) => s.id === "needs_attention");
    assert.ok(needs);
    assert.equal(needs.viewAllHref, null);
  });

  it("keeps uniform viewAllHref when all items share one destination", () => {
    const data = buildOperationsCentreFromDrafts([
      draft(
        "m1",
        {
          requiresStaffAction: true,
          isOverdue: false,
          isWaitingOnOther: false,
          isComingUp: false,
        },
        { recordType: "maintenance", viewAllHref: "/maintenance", title: "A" },
      ),
      draft(
        "m2",
        {
          requiresStaffAction: true,
          isOverdue: false,
          isWaitingOnOther: false,
          isComingUp: false,
        },
        { recordType: "maintenance", viewAllHref: "/maintenance", title: "B" },
      ),
    ]);
    const needs = data.sections.find((s) => s.id === "needs_attention");
    assert.ok(needs);
    assert.equal(needs.viewAllHref, "/maintenance");
  });
});

describe("sortOperationalWorkItems", () => {
  it("orders emergency above urgent above routine within a section", () => {
    const sorted = sortOperationalWorkItems([
      item({ key: "r", title: "Routine", urgency: "low" }),
      item({ key: "e", title: "Emergency", urgency: "high" }),
      item({ key: "u", title: "Urgent", urgency: "normal" }),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.key),
      ["e", "u", "r"],
    );
  });

  it("keeps overdue ahead of urgency", () => {
    const sorted = sortOperationalWorkItems([
      item({ key: "hi", title: "Emergency open", urgency: "high", isOverdue: false }),
      item({ key: "od", title: "Overdue lease", urgency: "normal", isOverdue: true }),
    ]);
    assert.equal(sorted[0]?.key, "od");
  });

  it("keeps earlier dueAt ahead of urgency when both have due dates", () => {
    const sorted = sortOperationalWorkItems([
      item({
        key: "later-hi",
        title: "Later emergency",
        urgency: "high",
        dueAt: "2026-07-20",
      }),
      item({
        key: "earlier-lo",
        title: "Earlier routine",
        urgency: "low",
        dueAt: "2026-07-12",
      }),
    ]);
    assert.equal(sorted[0]?.key, "earlier-lo");
  });

  it("does not change leasing title order when urgency is equal", () => {
    const sorted = sortOperationalWorkItems([
      item({ key: "b", title: "Bravo", urgency: "normal" }),
      item({ key: "a", title: "Alpha", urgency: "normal" }),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.title),
      ["Alpha", "Bravo"],
    );
  });
});

describe("resolveSectionViewAllHref", () => {
  it("returns null for mixed destinations", () => {
    const href = resolveSectionViewAllHref(
      [
        item({ key: "a", title: "A", urgency: "normal", viewAllHref: "/leasing" }),
        item({ key: "b", title: "B", urgency: "normal", viewAllHref: "/maintenance" }),
      ],
      "needs_attention",
    );
    assert.equal(href, null);
  });
});
