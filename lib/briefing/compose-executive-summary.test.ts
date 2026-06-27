import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeExecutiveSummary } from "@/lib/briefing/compose-executive-summary";
import { BriefingSourceType } from "@prisma/client";

describe("composeExecutiveSummary", () => {
  it("preserves Gemini email executive summary for parity", () => {
    const summary = composeExecutiveSummary({
      results: [
        {
          sourceType: BriefingSourceType.EMAIL,
          scannedCount: 1,
          skippedCount: 0,
          includedCount: 1,
          geminiCallCount: 1,
          warnings: [],
          moduleExecutiveLine: null,
          output: null,
          context: null,
        },
      ],
      output: {
        summaryTitle: "Morning briefing",
        executiveSummary: "One tenant maintenance item.",
        estimatedReadingMinutes: 2,
        scannedCount: 1,
        includedCount: 1,
        skippedCount: 0,
        sections: [],
        suggestedFollowUpActions: [],
        warnings: [],
      },
    });

    assert.equal(summary, "One tenant maintenance item.");
  });

  it("falls back to module lines when no Gemini output exists", () => {
    const summary = composeExecutiveSummary({
      results: [
        {
          sourceType: BriefingSourceType.MAINTENANCE,
          scannedCount: 0,
          skippedCount: 0,
          includedCount: 0,
          geminiCallCount: 0,
          warnings: [],
          moduleExecutiveLine: "2 open maintenance requests.",
          output: null,
          context: null,
        },
      ],
      output: null,
    });

    assert.equal(summary, "2 open maintenance requests.");
  });
});
