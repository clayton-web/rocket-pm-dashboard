import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BriefingItemCategory, BriefingSourceType } from "@prisma/client";
import { collectEmailBriefingSource } from "@/lib/briefing/sources/email/email-briefing-module";
import type { BriefingSourceRunContext } from "@/lib/briefing/sources/types";

const baseCtx: BriefingSourceRunContext = {
  organizationId: "org_1",
  organization: { id: "org_1", name: "Axford PM" },
  slot: "MORNING",
  window: {
    windowStart: new Date("2026-06-26T07:00:00.000Z"),
    windowEnd: new Date("2026-06-26T14:00:00.000Z"),
  },
  settings: {
    lookbackHours: 12,
    timezone: "America/Vancouver",
    morningLocalTime: "07:00",
    afternoonLocalTime: "14:00",
    activeSourceTypes: [BriefingSourceType.EMAIL],
  },
};

describe("collectEmailBriefingSource", () => {
  it("returns zero-item result without calling Gemini in dry run", async () => {
    let geminiCalled = false;

    const result = await collectEmailBriefingSource(
      { ...baseCtx, dryRun: true },
      {
        collectCandidates: async () => [
          {
            id: "thread_1",
            organizationId: "org_1",
            providerThreadId: "gmail_1",
            subject: "Test",
            snippet: "Snippet",
            category: "TENANT_COMMUNICATION",
            categoryConfidence: 0.9,
            participantEmails: ["tenant@example.com"],
            lastMessageAt: new Date("2026-06-26T12:00:00.000Z"),
            isUnread: true,
            messages: [
              {
                id: "msg_1",
                providerMessageId: "gmail_msg_1",
                fromAddr: "tenant@example.com",
                isOutbound: false,
                sentAt: new Date("2026-06-26T12:00:00.000Z"),
                bodyText: null,
              },
            ],
          },
        ],
        evaluateFilters: async (threads) =>
          threads.map((thread) => ({
            threadId: thread.id,
            include: true,
            sourceType: BriefingSourceType.EMAIL,
            categorySuggestion: BriefingItemCategory.TENANT,
            urgencySuggestion: null,
            reasonCodes: [],
            entityHints: {},
            priorityScore: 10,
          })),
        generateBriefing: async () => {
          geminiCalled = true;
          throw new Error("Gemini should not run in dry run");
        },
      },
    );

    assert.equal(result.sourceType, BriefingSourceType.EMAIL);
    assert.equal(result.includedCount, 1);
    assert.equal(result.geminiCallCount, 0);
    assert.equal(result.output, null);
    assert.equal(geminiCalled, false);
  });

  it("calls Gemini when included threads exist and dryRun is false", async () => {
    let geminiCalled = false;

    const result = await collectEmailBriefingSource(baseCtx, {
      collectCandidates: async () => [
        {
          id: "thread_1",
          organizationId: "org_1",
          providerThreadId: "gmail_1",
          subject: "Test",
          snippet: "Snippet",
          category: "TENANT_COMMUNICATION",
          categoryConfidence: 0.9,
          participantEmails: ["tenant@example.com"],
          lastMessageAt: new Date("2026-06-26T12:00:00.000Z"),
          isUnread: true,
          messages: [
            {
              id: "msg_1",
              providerMessageId: "gmail_msg_1",
              fromAddr: "tenant@example.com",
              isOutbound: false,
              sentAt: new Date("2026-06-26T12:00:00.000Z"),
              bodyText: null,
            },
          ],
        },
      ],
      evaluateFilters: async (threads) =>
        threads.map((thread) => ({
          threadId: thread.id,
          include: true,
          sourceType: BriefingSourceType.EMAIL,
          categorySuggestion: BriefingItemCategory.TENANT,
          urgencySuggestion: null,
          reasonCodes: [],
          entityHints: {},
          priorityScore: 10,
        })),
      generateBriefing: async () => {
        geminiCalled = true;
        return {
          geminiCallCount: 1,
          output: {
            summaryTitle: "Morning briefing",
            executiveSummary: "One item.",
            estimatedReadingMinutes: 2,
            scannedCount: 1,
            includedCount: 1,
            skippedCount: 0,
            sections: [],
            suggestedFollowUpActions: [],
            warnings: [],
          },
        };
      },
    });

    assert.equal(geminiCalled, true);
    assert.equal(result.geminiCallCount, 1);
    assert.equal(result.output?.executiveSummary, "One item.");
  });
});
