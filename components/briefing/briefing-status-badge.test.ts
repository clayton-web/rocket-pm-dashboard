import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BRIEFING_STATUS_TONES,
  BriefingStatusBadge,
} from "@/components/briefing/briefing-status-badge";
import { BRIEFING_STATUS_LABELS } from "@/lib/briefing/briefing-queries";
import { BriefingRunStatus } from "@prisma/client";

const STATUSES = Object.values(BriefingRunStatus);

describe("briefing run status tones", () => {
  it("maps every run status onto a tone", () => {
    for (const status of STATUSES) {
      assert.ok(BRIEFING_STATUS_TONES[status], `${status} has no tone`);
    }
  });

  it("keeps outcomes visually distinguishable from each other", () => {
    const outcomes = [
      BRIEFING_STATUS_TONES.COMPLETED,
      BRIEFING_STATUS_TONES.PARTIAL,
      BRIEFING_STATUS_TONES.FAILED,
    ];
    assert.equal(new Set(outcomes).size, outcomes.length);
  });

  it("treats a failed run as danger and an in-flight run as informational", () => {
    assert.equal(BRIEFING_STATUS_TONES.FAILED, "danger");
    assert.equal(BRIEFING_STATUS_TONES.RUNNING, "info");
    assert.equal(BRIEFING_STATUS_TONES.PENDING, "neutral");
  });
});

describe("BriefingStatusBadge", () => {
  it("renders the status label as text so meaning never rests on colour", () => {
    for (const status of STATUSES) {
      const html = renderToStaticMarkup(BriefingStatusBadge({ status }));
      assert.match(html, new RegExp(BRIEFING_STATUS_LABELS[status]), status);
    }
  });

  it("uses the shared badge treatment rather than a briefing-local palette", () => {
    const html = renderToStaticMarkup(BriefingStatusBadge({ status: "RUNNING" }));
    assert.match(html, /info-surface/);
    assert.doesNotMatch(html, /\b(?:bg|text|border)-blue-\d{2,3}\b/);
  });
});
