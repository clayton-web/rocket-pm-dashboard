import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOperationsCentreFromDrafts,
  type OperationsSourceError,
} from "./operations-centre.service";
import type { OperationalWorkItemDraft } from "./work-item";
import { OPERATIONS_PREVIEW_LIMIT } from "./work-item";

function draft(
  key: string,
  sectionSignals: OperationalWorkItemDraft["signals"],
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
});
