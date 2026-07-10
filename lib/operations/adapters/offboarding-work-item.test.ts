import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOffboardingNextStep } from "@/lib/leasing/offboarding-progress";
import type { OffboardingAttentionRow } from "@/lib/leasing/offboarding-attention-queue";
import {
  adaptOffboardingToWorkItemDraft,
  resolveOffboardingNextStep,
} from "./offboarding-work-item";
import { classifyWorkItem } from "../classify-work-item";

const noticeBase = {
  id: "notice_1",
  tenancyId: "ten_1",
  propertyId: "prop_1",
  propertyName: "100 Oak St",
  unitLabel: "Unit 4",
  tenantLabel: "Tom Tenant",
  tenantRequestedMoveOutDate: "2026-07-20",
  submittedAt: "2026-07-05T12:00:00.000Z",
};

describe("adaptOffboardingToWorkItemDraft", () => {
  it("uses Accept notice for pending notices", () => {
    const row: OffboardingAttentionRow = {
      kind: "pending_notice",
      badgeLabel: "Pending review",
      href: "/leasing/notices/notice_1",
      sortAt: noticeBase.submittedAt,
      tenantLabel: noticeBase.tenantLabel,
      propertyName: noticeBase.propertyName,
      unitLabel: noticeBase.unitLabel,
      dateLabel: noticeBase.tenantRequestedMoveOutDate,
      datePrefix: "Requested move-out · ",
      notice: noticeBase,
    };
    const next = resolveOffboardingNextStep(row);
    assert.equal(next.kind, "accept_notice");
    const draft = adaptOffboardingToWorkItemDraft(row, next);
    assert.equal(draft.nextActionLabel, "Accept notice");
    assert.equal(classifyWorkItem(draft)?.primarySection, "needs_attention");
  });

  it("matches getOffboardingNextStep for inspection schedule", () => {
    const expected = getOffboardingNextStep("move_out_scheduled", {
      acceptedNoticeId: null,
      awaitingScheduleNoticeId: null,
    });
    const row: OffboardingAttentionRow = {
      kind: "awaiting_inspection_schedule",
      badgeLabel: "Schedule inspection",
      href: "/leasing/tenancies/ten_1",
      sortAt: "2026-07-08T12:00:00.000Z",
      tenantLabel: "Tom Tenant",
      propertyName: "100 Oak St",
      unitLabel: "Unit 4",
      dateLabel: "2026-07-20",
      datePrefix: "Move-out · ",
      tenancy: {
        id: "ten_1",
        status: "move_out_scheduled",
        propertyId: "prop_1",
        propertyName: "100 Oak St",
        unitLabel: "Unit 4",
        tenantLabel: "Tom Tenant",
        moveOutDate: "2026-07-20",
        inspectionDate: null,
        updatedAt: "2026-07-08T12:00:00.000Z",
      },
    };
    const draft = adaptOffboardingToWorkItemDraft(row);
    assert.equal(draft.nextActionLabel, expected.title);
    assert.equal(draft.nextActionLabel, "Schedule move-out inspection");
  });

  it("matches getOffboardingNextStep for complete inspection", () => {
    const expected = getOffboardingNextStep("inspection_scheduled", {
      acceptedNoticeId: null,
      awaitingScheduleNoticeId: null,
    });
    const row: OffboardingAttentionRow = {
      kind: "awaiting_inspection_complete",
      badgeLabel: "Complete inspection",
      href: "/leasing/tenancies/ten_1",
      sortAt: "2026-07-08T12:00:00.000Z",
      tenantLabel: "Tom Tenant",
      propertyName: "100 Oak St",
      unitLabel: "Unit 4",
      dateLabel: "2026-07-05",
      datePrefix: "Inspection · ",
      tenancy: {
        id: "ten_1",
        status: "inspection_scheduled",
        propertyId: "prop_1",
        propertyName: "100 Oak St",
        unitLabel: "Unit 4",
        tenantLabel: "Tom Tenant",
        moveOutDate: "2026-07-04",
        inspectionDate: "2026-07-05",
        updatedAt: "2026-07-08T12:00:00.000Z",
      },
    };
    const draft = adaptOffboardingToWorkItemDraft(row);
    assert.equal(draft.nextActionLabel, expected.title);
    assert.equal(classifyWorkItem(draft)?.primarySection, "overdue");
  });
});
