import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingSourceType } from "@prisma/client";
import { mergeSourceResults } from "@/lib/briefing/sources/merge-source-results";
import type { BriefingSourceResult } from "@/lib/briefing/sources/types";

function result(
  overrides: Partial<BriefingSourceResult> & Pick<BriefingSourceResult, "sourceType">,
): BriefingSourceResult {
  return {
    scannedCount: 0,
    skippedCount: 0,
    includedCount: 0,
    geminiCallCount: 0,
    warnings: [],
    moduleExecutiveLine: null,
    output: null,
    context: null,
    ...overrides,
  };
}

describe("mergeSourceResults", () => {
  it("aggregates counts across modules", () => {
    const merged = mergeSourceResults([
      result({
        sourceType: BriefingSourceType.EMAIL,
        scannedCount: 10,
        skippedCount: 3,
        includedCount: 2,
        geminiCallCount: 1,
      }),
      result({
        sourceType: BriefingSourceType.MAINTENANCE,
        scannedCount: 0,
        skippedCount: 0,
        includedCount: 0,
        geminiCallCount: 0,
      }),
    ]);

    assert.equal(merged.scannedCount, 10);
    assert.equal(merged.skippedCount, 3);
    assert.equal(merged.includedCount, 2);
    assert.equal(merged.geminiCallCount, 1);
    assert.deepEqual(merged.activeSourceTypes, [
      BriefingSourceType.EMAIL,
      BriefingSourceType.MAINTENANCE,
    ]);
  });

  it("preserves email output and context from the contributing module", () => {
    const output = {
      summaryTitle: "Morning briefing",
      executiveSummary: "One item.",
      estimatedReadingMinutes: 2,
      scannedCount: 1,
      includedCount: 1,
      skippedCount: 0,
      sections: [],
      suggestedFollowUpActions: [],
      warnings: [],
    };
    const context = {
      promptVersion: "daily-briefing-v1",
      organization: { id: "org_1", name: "Test Org" },
      slot: "MORNING" as const,
      window: { start: "2026-06-26T07:00:00.000Z", end: "2026-06-26T14:00:00.000Z" },
      activeSourceTypes: [BriefingSourceType.EMAIL],
      scopeNote: "test",
      counts: { scanned: 1, included: 1, skipped: 0 },
      threads: [],
    };

    const merged = mergeSourceResults([
      result({
        sourceType: BriefingSourceType.EMAIL,
        includedCount: 1,
        output,
        context,
      }),
      result({ sourceType: BriefingSourceType.DEPOSIT }),
    ]);

    assert.equal(merged.output, output);
    assert.equal(merged.context, context);
  });

  it("returns zero totals for all-empty stub results", () => {
    const merged = mergeSourceResults([
      result({ sourceType: BriefingSourceType.MAINTENANCE }),
      result({ sourceType: BriefingSourceType.SYSTEM }),
    ]);

    assert.equal(merged.scannedCount, 0);
    assert.equal(merged.includedCount, 0);
    assert.equal(merged.output, null);
    assert.equal(merged.context, null);
  });
});
