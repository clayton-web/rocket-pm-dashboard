import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MAINTENANCE_STATUS_LABELS,
  MaintenanceStatusBadge,
  maintenanceStatusChipClasses,
} from "@/components/maintenance/maintenance-status-badge";
import type { MaintenanceWorkflowStatus } from "@/components/maintenance/types";

const STATUSES: MaintenanceWorkflowStatus[] = ["new", "dispatched", "completed", "cancelled"];

const RAW_PALETTE = /\b(?:bg|text|border)-(?:neutral|gray|slate|zinc|stone)-\d{2,3}\b/;
const ANY_HUE =
  /\b(?:bg|text|border)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

describe("maintenance workflow status chip", () => {
  it("gives every workflow status a label and a treatment", () => {
    for (const status of STATUSES) {
      assert.ok(MAINTENANCE_STATUS_LABELS[status], `${status} has no label`);
      assert.ok(maintenanceStatusChipClasses(status), `${status} has no treatment`);
    }
  });

  it("uses semantic tokens rather than raw palette classes", () => {
    for (const status of STATUSES) {
      assert.doesNotMatch(maintenanceStatusChipClasses(status), RAW_PALETTE, status);
    }
  });

  /**
   * The convention this batch deliberately preserved: workflow position is achromatic, so hue stays
   * free to mean urgency on the same row. A regression here would put two colour systems in one row.
   */
  it("stays achromatic so it never competes with the urgency accent", () => {
    for (const status of STATUSES) {
      assert.doesNotMatch(maintenanceStatusChipClasses(status), ANY_HUE, status);
    }
  });

  it("marks completion with the dark primary fill and fades a cancelled request", () => {
    assert.match(maintenanceStatusChipClasses("completed"), /bg-primary text-primary-foreground/);
    assert.match(maintenanceStatusChipClasses("cancelled"), /text-foreground-subtle/);
    assert.doesNotMatch(maintenanceStatusChipClasses("cancelled"), /\bbg-/);
  });

  it("keeps the four states visually distinct from one another", () => {
    const treatments = STATUSES.map((s) => maintenanceStatusChipClasses(s));
    assert.equal(new Set(treatments).size, treatments.length);
  });
});

describe("MaintenanceStatusBadge", () => {
  it("renders the label as text so meaning never rests on colour", () => {
    for (const status of STATUSES) {
      const html = renderToStaticMarkup(MaintenanceStatusBadge({ status }));
      assert.match(html, new RegExp(MAINTENANCE_STATUS_LABELS[status]), status);
    }
  });
});
