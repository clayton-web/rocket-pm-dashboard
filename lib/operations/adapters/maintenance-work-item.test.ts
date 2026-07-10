import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MaintenanceOpsQueueRow } from "@/lib/maintenance/maintenance-ops-queue";
import { MAINTENANCE_NEXT_ACTION_LABELS } from "@/lib/maintenance/maintenance-next-action";
import { classifyWorkItem } from "../classify-work-item";
import {
  adaptMaintenanceToWorkItemDraft,
  mapMaintenanceUrgencyToWorkItemUrgency,
} from "./maintenance-work-item";

function baseRow(overrides: Partial<MaintenanceOpsQueueRow> = {}): MaintenanceOpsQueueRow {
  return {
    id: "req_1",
    organizationId: "org_1",
    propertyId: "prop_1",
    propertyLabel: "100 Oak St",
    unitLabel: "2B",
    title: "Leaking faucet",
    status: "new",
    managerStatus: "new",
    urgency: "routine",
    assignedVendorName: null,
    submittedAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("adaptMaintenanceToWorkItemDraft", () => {
  it("builds stable key, record type, and detail URL for new requests", () => {
    const draft = adaptMaintenanceToWorkItemDraft(baseRow());
    assert.ok(draft);
    assert.equal(draft.key, "maintenance:req_1");
    assert.equal(draft.recordType, "maintenance");
    assert.equal(draft.href, "/maintenance/req_1");
    assert.equal(draft.viewAllHref, "/maintenance");
    assert.equal(draft.propertyLabel, "100 Oak St");
    assert.equal(draft.unitLabel, "2B");
    assert.equal(draft.nextActionLabel, MAINTENANCE_NEXT_ACTION_LABELS.review_and_dispatch);
    assert.equal(draft.statusLabel, "New");
    assert.equal(draft.workflowBadge, "Maintenance");
    assert.equal(draft.dueAt, null);
    assert.equal(draft.signals.requiresStaffAction, true);
    assert.equal(draft.signals.isOverdue, false);
    assert.equal(draft.signals.isComingUp, false);
    assert.equal(draft.signals.isWaitingOnOther, false);
  });

  it("uses Mark as completed for dispatched follow-up", () => {
    const draft = adaptMaintenanceToWorkItemDraft(
      baseRow({ status: "dispatched", managerStatus: "dispatched" }),
    );
    assert.ok(draft);
    assert.equal(draft.nextActionLabel, MAINTENANCE_NEXT_ACTION_LABELS.mark_as_completed);
    assert.equal(draft.statusLabel, "Dispatched");
  });

  it("maps urgency and adds Emergency / Urgent text indicators", () => {
    assert.equal(mapMaintenanceUrgencyToWorkItemUrgency("emergency"), "high");
    assert.equal(mapMaintenanceUrgencyToWorkItemUrgency("urgent"), "normal");
    assert.equal(mapMaintenanceUrgencyToWorkItemUrgency("routine"), "low");

    const emergency = adaptMaintenanceToWorkItemDraft(baseRow({ urgency: "emergency" }));
    assert.ok(emergency);
    assert.equal(emergency.urgency, "high");
    assert.ok(emergency.secondaryIndicators.includes("Emergency"));

    const urgent = adaptMaintenanceToWorkItemDraft(baseRow({ urgency: "urgent" }));
    assert.ok(urgent);
    assert.equal(urgent.urgency, "normal");
    assert.ok(urgent.secondaryIndicators.includes("Urgent"));

    const routine = adaptMaintenanceToWorkItemDraft(baseRow({ urgency: "routine" }));
    assert.ok(routine);
    assert.equal(routine.urgency, "low");
    assert.ok(!routine.secondaryIndicators.includes("Emergency"));
    assert.ok(!routine.secondaryIndicators.includes("Urgent"));
  });

  it("adds Waiting on vendor via waitingOn when assignee present; stays needs_attention", () => {
    const draft = adaptMaintenanceToWorkItemDraft(
      baseRow({
        managerStatus: "dispatched",
        status: "dispatched",
        assignedVendorName: "Acme Plumbing",
      }),
    );
    assert.ok(draft);
    assert.equal(draft.waitingOn, "vendor");
    assert.equal(draft.assignedToLabel, "Acme Plumbing");
    assert.ok(!draft.secondaryIndicators.includes("Unassigned"));
    assert.equal(draft.signals.requiresStaffAction, true);
    assert.equal(draft.signals.isWaitingOnOther, false);

    const classified = classifyWorkItem(draft);
    assert.ok(classified);
    assert.equal(classified.primarySection, "needs_attention");
    assert.ok(classified.secondaryIndicators.includes("Waiting on vendor"));
  });

  it("adds Unassigned for dispatched without assignee", () => {
    const draft = adaptMaintenanceToWorkItemDraft(
      baseRow({ managerStatus: "dispatched", status: "dispatched", assignedVendorName: null }),
    );
    assert.ok(draft);
    assert.ok(draft.secondaryIndicators.includes("Unassigned"));
    assert.equal(draft.waitingOn, "staff");
  });

  it("does not mark new requests Unassigned", () => {
    const draft = adaptMaintenanceToWorkItemDraft(baseRow({ managerStatus: "new" }));
    assert.ok(draft);
    assert.ok(!draft.secondaryIndicators.includes("Unassigned"));
  });

  it("returns null for terminal manager statuses", () => {
    assert.equal(
      adaptMaintenanceToWorkItemDraft(baseRow({ managerStatus: "completed", status: "completed" })),
      null,
    );
    assert.equal(
      adaptMaintenanceToWorkItemDraft(baseRow({ managerStatus: "cancelled", status: "cancelled" })),
      null,
    );
  });

  it("classifies new maintenance as needs_attention", () => {
    const draft = adaptMaintenanceToWorkItemDraft(baseRow());
    assert.ok(draft);
    const classified = classifyWorkItem(draft);
    assert.ok(classified);
    assert.equal(classified.primarySection, "needs_attention");
  });
});
