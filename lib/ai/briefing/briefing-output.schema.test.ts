import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BriefingOutputValidationError,
  parseBriefingGeminiOutput,
} from "@/lib/ai/briefing/briefing-output.schema";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";

function validOutput() {
  return {
    summaryTitle: "Morning briefing — 3 items need attention",
    executiveSummary: "Two tenant maintenance threads and one strata notice require follow-up today.",
    estimatedReadingMinutes: 4,
    scannedCount: 10,
    includedCount: 3,
    skippedCount: 7,
    sections: [
      {
        category: "TENANT",
        items: [
          {
            sourceType: "EMAIL",
            sourceThreadId: "thread_1",
            summaryTitle: "Leaking sink — Unit 204",
            category: "TENANT",
            urgency: "HIGH",
            keyFacts: ["Tenant reports active leak under kitchen sink"],
            requiredAction: "Schedule plumber",
            suggestedReplyNotes: "Acknowledge and provide ETA",
            confidence: 0.92,
            isPropertyManagementRelated: true,
            dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
          },
        ],
      },
    ],
    suggestedFollowUpActions: [
      {
        action: "Confirm plumber dispatch for Unit 204",
        relatedThreadId: "thread_1",
        priority: "HIGH",
      },
    ],
    warnings: [],
  };
}

describe("parseBriefingGeminiOutput", () => {
  it("accepts valid briefing JSON", () => {
    const parsed = parseBriefingGeminiOutput(validOutput());
    assert.equal(parsed.summaryTitle, "Morning briefing — 3 items need attention");
    assert.equal(parsed.sections[0]?.items[0]?.sourceThreadId, "thread_1");
  });

  it("rejects invalid category values", () => {
    const invalid = {
      ...validOutput(),
      sections: [
        {
          category: "NOT_A_REAL_CATEGORY",
          items: validOutput().sections[0]!.items,
        },
      ],
    };

    assert.throws(
      () => parseBriefingGeminiOutput(invalid),
      (error: unknown) => {
        assert.ok(error instanceof BriefingOutputValidationError);
        assert.ok(error.issues.some((issue) => issue.includes("category")));
        return true;
      },
    );
  });

  it("rejects invalid urgency values", () => {
    const invalid = {
      ...validOutput(),
      sections: [
        {
          category: "TENANT",
          items: [
            {
              ...validOutput().sections[0]!.items[0]!,
              urgency: "CRITICAL",
            },
          ],
        },
      ],
    };

    assert.throws(
      () => parseBriefingGeminiOutput(invalid),
      (error: unknown) => {
        assert.ok(error instanceof BriefingOutputValidationError);
        assert.ok(error.issues.some((issue) => issue.includes("urgency")));
        return true;
      },
    );
  });

  it("rejects more than five keyFacts", () => {
    const invalid = {
      ...validOutput(),
      sections: [
        {
          category: "TENANT",
          items: [
            {
              ...validOutput().sections[0]!.items[0]!,
              keyFacts: ["1", "2", "3", "4", "5", "6"],
            },
          ],
        },
      ],
    };

    assert.throws(() => parseBriefingGeminiOutput(invalid), BriefingOutputValidationError);
  });

  it("rejects inactive financial source types in MVP", () => {
    const invalid = {
      ...validOutput(),
      sections: [
        {
          category: "RENT_DEPOSIT",
          items: [
            {
              ...validOutput().sections[0]!.items[0]!,
              sourceType: "RENT_PAYMENT",
              category: "RENT_DEPOSIT",
              dataProvenance: BRIEFING_DATA_PROVENANCE.ACCOUNTING_SYSTEM,
            },
          ],
        },
      ],
    };

    assert.throws(
      () => parseBriefingGeminiOutput(invalid),
      (error: unknown) => {
        assert.ok(error instanceof BriefingOutputValidationError);
        assert.ok(error.issues.some((issue) => issue.includes("RENT_PAYMENT")));
        return true;
      },
    );
  });

  it("defaults dataProvenance to EMAIL_MENTION when omitted", () => {
    const raw = validOutput();
    const item = { ...raw.sections[0]!.items[0]! };
    delete (item as { dataProvenance?: string }).dataProvenance;
    const parsed = parseBriefingGeminiOutput({
      ...raw,
      sections: [{ category: "TENANT", items: [item] }],
    });
    assert.equal(
      parsed.sections[0]?.items[0]?.dataProvenance,
      BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
    );
  });
});
