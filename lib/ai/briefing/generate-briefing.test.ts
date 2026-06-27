import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingSlot } from "@prisma/client";
import { BriefingOutputValidationError } from "@/lib/ai/briefing/briefing-output.schema";
import { generateBriefingFromContext } from "@/lib/ai/briefing/generate-briefing";
import type { BriefingContext } from "@/lib/briefing/briefing-types";

const sampleContext: BriefingContext = {
  promptVersion: "daily-briefing-v1",
  organization: { id: "org_1", name: "Axford PM" },
  slot: BriefingSlot.MORNING,
  window: {
    start: "2026-06-26T07:00:00.000Z",
    end: "2026-06-26T14:00:00.000Z",
  },
  activeSourceTypes: ["EMAIL"],
  scopeNote: "EMAIL-only MVP.",
  counts: { scanned: 1, included: 1, skipped: 0 },
  threads: [
    {
      threadId: "thread_1",
      newestMessageId: "msg_1",
      providerThreadId: "gmail_thread_1",
      providerMessageId: "gmail_msg_1",
      sender: "Alex Tenant",
      senderEmail: "tenant@example.com",
      subject: "Leaking sink",
      excerpt: "Water under the kitchen sink.",
      categoryHint: "TENANT",
      urgencyHint: "HIGH",
      entityHints: {},
      reasonCodes: ["matched_tenant_email"],
      dataProvenance: "EMAIL_MENTION",
      lastMessageAt: "2026-06-26T12:00:00.000Z",
      isUnread: true,
    },
  ],
};

describe("generateBriefingFromContext", () => {
  it("returns validated output from mocked Gemini completion", async () => {
    const result = await generateBriefingFromContext({
      context: sampleContext,
      createCompletion: async () => ({
        summaryTitle: "Morning briefing",
        executiveSummary: "One tenant maintenance item needs follow-up.",
        estimatedReadingMinutes: 2,
        scannedCount: 1,
        includedCount: 1,
        skippedCount: 0,
        sections: [
          {
            category: "TENANT",
            items: [
              {
                sourceType: "EMAIL",
                sourceThreadId: "thread_1",
                summaryTitle: "Leaking sink",
                category: "TENANT",
                urgency: "HIGH",
                keyFacts: ["Active leak reported"],
                isPropertyManagementRelated: true,
                dataProvenance: "EMAIL_MENTION",
              },
            ],
          },
        ],
        suggestedFollowUpActions: [],
        warnings: [],
      }),
    });

    assert.equal(result.geminiCallCount, 1);
    assert.equal(result.output.includedCount, 1);
    assert.equal(result.output.sections[0]?.items[0]?.sourceThreadId, "thread_1");
  });

  it("propagates validation errors from invalid Gemini JSON", async () => {
    await assert.rejects(
      () =>
        generateBriefingFromContext({
          context: sampleContext,
          createCompletion: async () => ({ summaryTitle: "missing fields" }),
        }),
      BriefingOutputValidationError,
    );
  });
});
