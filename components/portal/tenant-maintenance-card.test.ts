import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TenantMaintenanceCard,
  TenantMaintenanceDetailPanel,
} from "@/components/portal/tenant-maintenance-card";
import type { TenantMaintenanceStatusView } from "@/lib/portal/maintenance-tenant-status";

const REQUEST: TenantMaintenanceStatusView = {
  id: "cmrfgddzl00186epfpnsiq1vf",
  title: "Kitchen sink slow drain",
  statusLabel: "Received — our team will review it",
  urgency: "routine",
  trade: "plumbing",
  submittedAt: "2026-03-01T18:00:00.000Z",
  scheduledWorkAt: null,
  completedAt: null,
};

const RAW_PALETTE = /\b(?:bg|text|border)-(?:white|neutral|gray|slate|zinc|stone)-?\d{0,3}\b/;

describe("TenantMaintenanceCard", () => {
  it("uses semantic tokens rather than raw palette classes", () => {
    const html = renderToStaticMarkup(
      TenantMaintenanceCard({ request: REQUEST, detailHref: "/portal/maintenance/x" }),
    );
    const leak = html.match(RAW_PALETTE);
    assert.equal(leak, null, `leaked ${leak?.[0]}`);
  });

  it("gives the whole card a visible keyboard focus stop", () => {
    const html = renderToStaticMarkup(
      TenantMaintenanceCard({ request: REQUEST, detailHref: "/portal/maintenance/x" }),
    );
    assert.match(html, /focus-visible:outline-focus/);
  });

  /**
   * Tenant status is deliberately a reassuring sentence rather than a `StatusBadge`. The labels are
   * written as explanations ("Received — our team will review it"), which a chip cannot carry, and
   * the tenant surface has no operational triage to scan. Migrating this to the staff chip
   * vocabulary would be a redesign, not a token migration.
   */
  it("renders status as plain sentence text, not an operational chip", () => {
    const html = renderToStaticMarkup(
      TenantMaintenanceCard({ request: REQUEST, detailHref: "/portal/maintenance/x" }),
    );
    assert.match(html, /Received — our team will review it/);
    assert.doesNotMatch(html, /rounded-md border px-2 py-0\.5/);
  });
});

describe("TenantMaintenanceDetailPanel", () => {
  it("uses semantic tokens rather than raw palette classes", () => {
    const html = renderToStaticMarkup(TenantMaintenanceDetailPanel({ request: REQUEST }));
    const leak = html.match(RAW_PALETTE);
    assert.equal(leak, null, `leaked ${leak?.[0]}`);
  });

  it("keeps every field labelled by a description list rather than by position", () => {
    const html = renderToStaticMarkup(TenantMaintenanceDetailPanel({ request: REQUEST }));
    for (const label of ["Status", "Submitted", "Urgency / trade", "Scheduled work", "Completed"]) {
      assert.ok(html.includes(`<dt`) && html.includes(label), `${label} is not in the list`);
    }
  });
});
