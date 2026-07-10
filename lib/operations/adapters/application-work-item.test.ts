import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getApplicationConversionPolicy } from "@/lib/leasing/application-conversion-policy";
import type { ApplicationConversionQueueRow } from "@/lib/leasing/application-conversion-staff-queue";
import type { ApplicationQueueRow } from "@/lib/leasing/application-staff-queue";
import {
  adaptApplicationConversionToWorkItemDraft,
  adaptApplicationReviewToWorkItemDraft,
} from "./application-work-item";
import { labelForApplicationConversionPolicy } from "../next-action-labels";
import { classifyWorkItem } from "../classify-work-item";

const reviewRow: ApplicationQueueRow = {
  id: "app_1",
  status: "submitted",
  submittedAt: "2026-07-08T12:00:00.000Z",
  propertyId: "prop_1",
  propertyName: "100 Oak St",
  unitLabel: "Unit 1",
  firstName: "Grace",
  lastName: "Hopper",
  email: "grace@example.com",
  phone: null,
  desiredMoveInDate: "2026-08-01",
};

describe("adaptApplicationReviewToWorkItemDraft", () => {
  it("uses Review application and needs attention", () => {
    const draft = adaptApplicationReviewToWorkItemDraft(reviewRow);
    assert.equal(draft.nextActionLabel, "Review application");
    assert.equal(draft.href, "/leasing/applications/app_1");
    assert.equal(classifyWorkItem(draft)?.primarySection, "needs_attention");
  });
});

describe("adaptApplicationConversionToWorkItemDraft", () => {
  it("matches getApplicationConversionPolicy for managed conversion", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "approved",
      hasTenancy: false,
      serviceRelationship: "MANAGED",
    });
    const row: ApplicationConversionQueueRow = {
      ...reviewRow,
      status: "approved",
      decisionAt: "2026-07-09T12:00:00.000Z",
      serviceRelationship: "MANAGED",
      conversionStateLabel: policy.staffStateLabel,
      canConvertToManagedTenancy: policy.allowed,
      canCompletePlacement: false,
    };
    const draft = adaptApplicationConversionToWorkItemDraft(row);
    assert.ok(draft);
    assert.equal(draft.nextActionLabel, labelForApplicationConversionPolicy(policy));
    assert.equal(draft.nextActionLabel, "Finish leasing");
    assert.equal(draft.statusLabel, "Ready to convert");
  });

  it("matches placement-only policy action", () => {
    const policy = getApplicationConversionPolicy({
      applicationStatus: "approved",
      hasTenancy: false,
      serviceRelationship: "PLACEMENT_ONLY",
    });
    const row: ApplicationConversionQueueRow = {
      ...reviewRow,
      status: "approved",
      decisionAt: "2026-07-09T12:00:00.000Z",
      serviceRelationship: "PLACEMENT_ONLY",
      conversionStateLabel: policy.staffStateLabel,
      canConvertToManagedTenancy: false,
      canCompletePlacement: true,
    };
    const draft = adaptApplicationConversionToWorkItemDraft(row);
    assert.ok(draft);
    assert.equal(draft.nextActionLabel, labelForApplicationConversionPolicy(policy));
    assert.equal(draft.statusLabel, "Placement completion required");
  });
});
