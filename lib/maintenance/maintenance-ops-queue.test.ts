import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MaintenanceRequestStatus } from "@prisma/client";
import {
  OPEN_MAINTENANCE_OPS_STATUSES,
  buildOpenMaintenanceOpsWhere,
  mapMaintenanceDbRowToOpsQueueRow,
} from "./maintenance-ops-queue";
import { toManagerWorkflowStatus } from "./workflow";

describe("maintenance-ops-queue", () => {
  it("excludes completed and cancelled from open status set", () => {
    assert.ok(!OPEN_MAINTENANCE_OPS_STATUSES.includes("completed"));
    assert.ok(!OPEN_MAINTENANCE_OPS_STATUSES.includes("cancelled"));
    for (const status of [
      "new",
      "triaged",
      "dispatched",
      "in_progress",
      "awaiting_owner_approval",
      "scheduled",
    ] as MaintenanceRequestStatus[]) {
      assert.ok(OPEN_MAINTENANCE_OPS_STATUSES.includes(status));
      assert.notEqual(toManagerWorkflowStatus(status), "completed");
      assert.notEqual(toManagerWorkflowStatus(status), "cancelled");
    }
  });

  it("builds org-scoped where with open statuses for admin (all properties)", () => {
    const where = buildOpenMaintenanceOpsWhere("org_1", "all");
    assert.deepEqual(where, {
      organizationId: "org_1",
      status: { in: [...OPEN_MAINTENANCE_OPS_STATUSES] },
    });
    assert.equal("propertyId" in where, false);
  });

  it("builds property-assignment scoped where for members", () => {
    const where = buildOpenMaintenanceOpsWhere("org_1", ["prop_a", "prop_b"]);
    assert.deepEqual(where, {
      organizationId: "org_1",
      status: { in: [...OPEN_MAINTENANCE_OPS_STATUSES] },
      propertyId: { in: ["prop_a", "prop_b"] },
    });
  });

  it("maps DB rows to queue fields with manager status and display labels", () => {
    const row = mapMaintenanceDbRowToOpsQueueRow({
      id: "req_1",
      organizationId: "org_1",
      propertyId: "prop_1",
      title: "Leaking faucet",
      status: "triaged",
      urgency: "urgent",
      assignedVendorName: "  Acme Plumbing  ",
      submittedAt: new Date("2026-07-01T15:00:00.000Z"),
      property: {
        name: "Oak House",
        streetLine1: "100 Oak St",
        streetLine2: null,
      },
      unit: { unitNumber: "2B" },
    });

    assert.equal(row.id, "req_1");
    assert.equal(row.propertyLabel, "100 Oak St");
    assert.equal(row.unitLabel, "2B");
    assert.equal(row.title, "Leaking faucet");
    assert.equal(row.status, "triaged");
    assert.equal(row.managerStatus, "new");
    assert.equal(row.urgency, "urgent");
    assert.equal(row.assignedVendorName, "Acme Plumbing");
    assert.equal(row.submittedAt, "2026-07-01T15:00:00.000Z");
  });

  it("treats empty assignee as null", () => {
    const row = mapMaintenanceDbRowToOpsQueueRow({
      id: "req_2",
      organizationId: "org_1",
      propertyId: "prop_1",
      title: "Fix door",
      status: "dispatched",
      urgency: "routine",
      assignedVendorName: "   ",
      submittedAt: new Date("2026-07-02T12:00:00.000Z"),
      property: { name: "Oak House", streetLine1: null, streetLine2: null },
      unit: { unitNumber: "1" },
    });
    assert.equal(row.assignedVendorName, null);
    assert.equal(row.managerStatus, "dispatched");
    assert.equal(row.propertyLabel, "Oak House");
  });
});
