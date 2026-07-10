import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MaintenanceRequestStatus } from "@prisma/client";
import {
  deriveMaintenanceNextAction,
  labelForManagerWorkflowStatus,
  MAINTENANCE_NEXT_ACTION_LABELS,
} from "./maintenance-next-action";
import { toManagerWorkflowStatus } from "./workflow";

describe("deriveMaintenanceNextAction", () => {
  it("returns Review and dispatch for new", () => {
    const next = deriveMaintenanceNextAction("new");
    assert.equal(next.kind, "review_and_dispatch");
    assert.equal(next.label, "Review and dispatch");
    assert.equal(next.eligible, true);
  });

  it("returns Mark as completed for dispatched (matches ActionCard button)", () => {
    const next = deriveMaintenanceNextAction("dispatched");
    assert.equal(next.kind, "mark_as_completed");
    assert.equal(next.label, "Mark as completed");
    assert.equal(next.label, MAINTENANCE_NEXT_ACTION_LABELS.mark_as_completed);
    assert.equal(next.eligible, true);
  });

  it("marks completed and cancelled as ineligible", () => {
    for (const status of ["completed", "cancelled"] as const) {
      const next = deriveMaintenanceNextAction(status);
      assert.equal(next.kind, "none");
      assert.equal(next.eligible, false);
    }
  });

  it("collapses triage-equivalent Prisma statuses through toManagerWorkflowStatus", () => {
    const triaged: MaintenanceRequestStatus = "triaged";
    assert.equal(toManagerWorkflowStatus(triaged), "new");
    assert.equal(
      deriveMaintenanceNextAction(toManagerWorkflowStatus(triaged)).label,
      "Review and dispatch",
    );
  });

  it("collapses active-equivalent Prisma statuses to dispatched next action", () => {
    const active: MaintenanceRequestStatus[] = [
      "dispatched",
      "in_progress",
      "awaiting_owner_approval",
      "scheduled",
    ];
    for (const status of active) {
      assert.equal(toManagerWorkflowStatus(status), "dispatched");
      assert.equal(
        deriveMaintenanceNextAction(toManagerWorkflowStatus(status)).label,
        "Mark as completed",
      );
    }
  });

  it("exposes manager status labels used by the list UI", () => {
    assert.equal(labelForManagerWorkflowStatus("new"), "New");
    assert.equal(labelForManagerWorkflowStatus("dispatched"), "Dispatched");
  });
});
