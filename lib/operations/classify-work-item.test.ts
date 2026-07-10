import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyWorkItem,
  isWorkItemEligible,
  resolvePrimarySection,
  SECTION_PRECEDENCE,
} from "./classify-work-item";
import type { OperationalWorkItemDraft } from "./work-item";

function draft(
  overrides: Partial<OperationalWorkItemDraft> & {
    signals: OperationalWorkItemDraft["signals"];
  },
): OperationalWorkItemDraft {
  return {
    key: "test:1",
    recordType: "prospect",
    recordId: "1",
    title: "Test",
    subtitle: null,
    propertyLabel: "123 Main",
    unitLabel: "1",
    statusLabel: "Status",
    nextActionLabel: "Do something",
    href: "/leasing/prospects/1",
    viewAllHref: "/leasing/prospects",
    workflowBadge: "Test",
    dueAt: null,
    waitingOn: "staff",
    assignedToLabel: null,
    urgency: "normal",
    secondaryIndicators: [],
    ...overrides,
  };
}

describe("isWorkItemEligible", () => {
  it("rejects items with no operational signals", () => {
    assert.equal(
      isWorkItemEligible(
        draft({
          signals: {
            requiresStaffAction: false,
            isOverdue: false,
            isWaitingOnOther: false,
            isComingUp: false,
          },
        }),
      ),
      false,
    );
  });

  it("accepts items with any single signal", () => {
    assert.equal(
      isWorkItemEligible(
        draft({
          signals: {
            requiresStaffAction: true,
            isOverdue: false,
            isWaitingOnOther: false,
            isComingUp: false,
          },
        }),
      ),
      true,
    );
    assert.equal(
      isWorkItemEligible(
        draft({
          signals: {
            requiresStaffAction: false,
            isOverdue: false,
            isWaitingOnOther: false,
            isComingUp: true,
          },
        }),
      ),
      true,
    );
  });
});

describe("resolvePrimarySection precedence", () => {
  it("documents overdue > needs_attention > waiting > coming_up", () => {
    assert.deepEqual(SECTION_PRECEDENCE, [
      "overdue",
      "needs_attention",
      "waiting",
      "coming_up",
    ]);
  });

  it("prefers overdue over staff action and waiting", () => {
    assert.equal(
      resolvePrimarySection(
        draft({
          waitingOn: "tenant",
          signals: {
            requiresStaffAction: true,
            isOverdue: true,
            isWaitingOnOther: true,
            isComingUp: true,
          },
        }),
      ),
      "overdue",
    );
  });

  it("prefers needs_attention over waiting and coming_up", () => {
    assert.equal(
      resolvePrimarySection(
        draft({
          signals: {
            requiresStaffAction: true,
            isOverdue: false,
            isWaitingOnOther: true,
            isComingUp: true,
          },
        }),
      ),
      "needs_attention",
    );
  });

  it("prefers waiting over coming_up", () => {
    assert.equal(
      resolvePrimarySection(
        draft({
          waitingOn: "applicant",
          signals: {
            requiresStaffAction: false,
            isOverdue: false,
            isWaitingOnOther: true,
            isComingUp: true,
          },
        }),
      ),
      "waiting",
    );
  });

  it("assigns coming_up when only upcoming", () => {
    assert.equal(
      resolvePrimarySection(
        draft({
          signals: {
            requiresStaffAction: false,
            isOverdue: false,
            isWaitingOnOther: false,
            isComingUp: true,
          },
        }),
      ),
      "coming_up",
    );
  });
});

describe("classifyWorkItem secondary indicators", () => {
  it("preserves waiting-on as secondary when primary is overdue", () => {
    const item = classifyWorkItem(
      draft({
        waitingOn: "tenant",
        secondaryIndicators: [],
        signals: {
          requiresStaffAction: true,
          isOverdue: true,
          isWaitingOnOther: true,
          isComingUp: false,
        },
      }),
    );
    assert.ok(item);
    assert.equal(item.primarySection, "overdue");
    assert.ok(item.secondaryIndicators.includes("Waiting on tenant"));
    // Do not repeat the primary section label as a secondary chip
    assert.equal(item.secondaryIndicators.includes("Overdue"), false);
    assert.equal(item.isOverdue, true);
    assert.equal(item.urgency, "high");
  });
});
