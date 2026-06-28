import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BriefingAttentionLabel,
  BriefingAttentionStatus,
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingSourceType,
  type EmailThreadBriefingAttention,
} from "@prisma/client";
import { BRIEFING_DATA_PROVENANCE } from "@/lib/briefing/briefing-sources";
import { BRIEFING_ATTENTION_SECTION } from "@/lib/briefing/sources/email/briefing-attention-constants";
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

const emptyActiveAttention = async () => ({
  carryForward: [] as EmailThreadBriefingAttention[],
  activeRowsConsidered: 0,
  clearedCount: 0,
});

const windowCandidate = {
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
};

function includeAllFilters(threads: typeof windowCandidate[]) {
  return threads.map((thread) => ({
    threadId: thread.id,
    include: true,
    sourceType: BriefingSourceType.EMAIL,
    categorySuggestion: BriefingItemCategory.TENANT,
    urgencySuggestion: null,
    reasonCodes: [],
    entityHints: {},
    priorityScore: 10,
  }));
}

function activeAttentionRow(
  overrides: Partial<EmailThreadBriefingAttention> = {},
): EmailThreadBriefingAttention {
  return {
    id: "attn_1",
    organizationId: "org_1",
    emailThreadId: "thread_carry",
    status: BriefingAttentionStatus.ACTIVE,
    firstSurfacedAt: new Date("2026-06-25T07:00:00.000Z"),
    lastSurfacedAt: new Date("2026-06-25T14:00:00.000Z"),
    lastSurfacedRunId: "run_prior",
    surfacedAtOutboundCount: 0,
    summaryTitle: "Prior leak",
    category: BriefingItemCategory.TENANT,
    urgency: BriefingItemUrgency.HIGH,
    subject: "Leaking sink",
    summaryJson: {
      keyFacts: ["Still leaking"],
      requiredAction: "Schedule plumber",
      suggestedReplyNotes: null,
      sender: "Alex Tenant",
      senderEmail: "tenant@example.com",
    },
    lastOutboundAt: null,
    resolvedAt: null,
    resolvedByUserId: null,
    resolutionReason: null,
    createdAt: new Date("2026-06-25T07:00:00.000Z"),
    updatedAt: new Date("2026-06-25T14:00:00.000Z"),
    ...overrides,
  };
}

describe("collectEmailBriefingSource", () => {
  it("returns zero-item result without calling Gemini in dry run", async () => {
    let geminiCalled = false;

    const result = await collectEmailBriefingSource(
      { ...baseCtx, dryRun: true },
      {
        processActiveEmailAttention: emptyActiveAttention,
        collectCandidates: async () => [windowCandidate],
        evaluateFilters: async (threads) => includeAllFilters(threads),
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

    const result = await collectEmailBriefingSource(
      { ...baseCtx, briefingRunId: "run_1" },
      {
        processActiveEmailAttention: emptyActiveAttention,
        collectCandidates: async () => [windowCandidate],
        evaluateFilters: async (threads) => includeAllFilters(threads),
        syncEmailAttentionRegistry: async ({ geminiItems }) => ({
          thread_1: {
            attentionLabel: BriefingAttentionLabel.NEW,
            attentionSection: BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
            emailThreadBriefingAttentionId: "attn_new",
            subject: "Test",
            summaryJson: {
              keyFacts: geminiItems[0]?.keyFacts ?? [],
              dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
            },
          },
        }),
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
              sections: [
                {
                  category: BriefingItemCategory.TENANT,
                  items: [
                    {
                      sourceType: BriefingSourceType.EMAIL,
                      sourceThreadId: "thread_1",
                      summaryTitle: "Test",
                      category: BriefingItemCategory.TENANT,
                      urgency: BriefingItemUrgency.HIGH,
                      keyFacts: ["Tenant reported issue"],
                      isPropertyManagementRelated: true,
                      dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
                    },
                  ],
                },
              ],
              suggestedFollowUpActions: [],
              warnings: [],
            },
          };
        },
      },
    );

    assert.equal(geminiCalled, true);
    assert.equal(result.geminiCallCount, 1);
    assert.equal(result.output?.executiveSummary, "One item.");
    assert.equal(
      result.emailItemPersistMetaByThreadId?.thread_1?.attentionLabel,
      BriefingAttentionLabel.NEW,
    );
    assert.equal(
      result.emailItemPersistMetaByThreadId?.thread_1?.attentionSection,
      BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
    );
  });

  it("upserts attention registry on first run with new window email", async () => {
    let syncCalled = false;

    await collectEmailBriefingSource(
      { ...baseCtx, briefingRunId: "run_1" },
      {
        processActiveEmailAttention: emptyActiveAttention,
        collectCandidates: async () => [windowCandidate],
        evaluateFilters: async (threads) => includeAllFilters(threads),
        syncEmailAttentionRegistry: async (args) => {
          syncCalled = true;
          assert.equal(args.geminiItems.length, 1);
          assert.equal(args.geminiItems[0]?.sourceThreadId, "thread_1");
          assert.equal(args.carryForwardRows.length, 0);
          return {
            thread_1: {
              attentionLabel: BriefingAttentionLabel.NEW,
              attentionSection: BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
              emailThreadBriefingAttentionId: "attn_new",
            },
          };
        },
        generateBriefing: async () => ({
          geminiCallCount: 1,
          output: {
            summaryTitle: "Morning briefing",
            executiveSummary: "One item.",
            estimatedReadingMinutes: 2,
            scannedCount: 1,
            includedCount: 1,
            skippedCount: 0,
            sections: [
              {
                category: BriefingItemCategory.TENANT,
                items: [
                  {
                    sourceType: BriefingSourceType.EMAIL,
                    sourceThreadId: "thread_1",
                    summaryTitle: "Test",
                    category: BriefingItemCategory.TENANT,
                    urgency: BriefingItemUrgency.HIGH,
                    keyFacts: ["Tenant reported issue"],
                    isPropertyManagementRelated: true,
                    dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
                  },
                ],
              },
            ],
            suggestedFollowUpActions: [],
            warnings: [],
          },
        }),
      },
    );

    assert.equal(syncCalled, true);
  });

  it("carries forward active items without calling Gemini when window is empty", async () => {
    let geminiCalled = false;
    const carryRow = activeAttentionRow();

    const result = await collectEmailBriefingSource(
      { ...baseCtx, briefingRunId: "run_2" },
      {
        processActiveEmailAttention: async () => ({
          carryForward: [carryRow],
          activeRowsConsidered: 1,
          clearedCount: 0,
        }),
        collectCandidates: async () => [],
        evaluateFilters: async () => [],
        syncEmailAttentionRegistry: async (args) => {
          assert.equal(args.geminiItems.length, 0);
          assert.equal(args.carryForwardRows.length, 1);
          return {};
        },
        generateBriefing: async () => {
          geminiCalled = true;
          throw new Error("Gemini should not run for carry-forward-only briefing");
        },
      },
    );

    assert.equal(geminiCalled, false);
    assert.equal(result.geminiCallCount, 0);
    assert.equal(result.includedCount, 1);
    assert.equal(result.output?.includedCount, 1);
    assert.equal(result.output?.sections[0]?.items[0]?.sourceThreadId, "thread_carry");
    assert.equal(result.output?.sections[0]?.items[0]?.summaryTitle, "Prior leak");
    assert.equal(
      result.emailItemPersistMetaByThreadId?.thread_carry?.attentionLabel,
      BriefingAttentionLabel.STILL_ACTIVE,
    );
    assert.equal(
      result.emailItemPersistMetaByThreadId?.thread_carry?.attentionSection,
      BRIEFING_ATTENTION_SECTION.STILL_NEEDS_ATTENTION,
    );
  });

  it("dry run counts carry-forward items toward includedCount", async () => {
    const result = await collectEmailBriefingSource(
      { ...baseCtx, dryRun: true },
      {
        processActiveEmailAttention: async () => ({
          carryForward: [activeAttentionRow()],
          activeRowsConsidered: 1,
          clearedCount: 0,
        }),
        collectCandidates: async () => [],
        evaluateFilters: async () => [],
      },
    );

    assert.equal(result.includedCount, 1);
    assert.equal(result.geminiCallCount, 0);
    assert.match(result.moduleExecutiveLine ?? "", /still need attention/);
  });

  it("does not carry forward items cleared by outbound reply evaluation", async () => {
    const result = await collectEmailBriefingSource(
      { ...baseCtx, briefingRunId: "run_3" },
      {
        processActiveEmailAttention: async () => ({
          carryForward: [],
          activeRowsConsidered: 1,
          clearedCount: 1,
        }),
        collectCandidates: async () => [],
        evaluateFilters: async () => [],
      },
    );

    assert.equal(result.includedCount, 0);
    assert.equal(result.output, null);
  });

  it("dedupes window and carry-forward threads in favor of the window item", async () => {
    const carryRow = activeAttentionRow({ emailThreadId: "thread_1", id: "attn_dup" });
    let syncGeminiThreadIds: string[] = [];

    const result = await collectEmailBriefingSource(
      { ...baseCtx, briefingRunId: "run_4" },
      {
        processActiveEmailAttention: async () => ({
          carryForward: [carryRow],
          activeRowsConsidered: 1,
          clearedCount: 0,
        }),
        collectCandidates: async () => [windowCandidate],
        evaluateFilters: async (threads) => includeAllFilters(threads),
        syncEmailAttentionRegistry: async (args) => {
          syncGeminiThreadIds = args.geminiItems.map((item) => item.sourceThreadId ?? "");
          assert.equal(args.carryForwardRows.length, 0);
          return {
            thread_1: {
              attentionLabel: BriefingAttentionLabel.NEW,
              attentionSection: BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
              emailThreadBriefingAttentionId: "attn_updated",
            },
          };
        },
        generateBriefing: async () => ({
          geminiCallCount: 1,
          output: {
            summaryTitle: "Morning briefing",
            executiveSummary: "Updated window item.",
            estimatedReadingMinutes: 2,
            scannedCount: 1,
            includedCount: 1,
            skippedCount: 0,
            sections: [
              {
                category: BriefingItemCategory.TENANT,
                items: [
                  {
                    sourceType: BriefingSourceType.EMAIL,
                    sourceThreadId: "thread_1",
                    summaryTitle: "Fresh Gemini summary",
                    category: BriefingItemCategory.TENANT,
                    urgency: BriefingItemUrgency.HIGH,
                    keyFacts: ["Updated facts"],
                    isPropertyManagementRelated: true,
                    dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
                  },
                ],
              },
            ],
            suggestedFollowUpActions: [],
            warnings: [],
          },
        }),
      },
    );

    assert.deepEqual(syncGeminiThreadIds, ["thread_1"]);
    assert.equal(result.includedCount, 1);
    assert.equal(result.output?.sections[0]?.items.length, 1);
    assert.equal(result.output?.sections[0]?.items[0]?.summaryTitle, "Fresh Gemini summary");
    assert.equal(result.emailItemPersistMetaByThreadId?.thread_1?.attentionLabel, BriefingAttentionLabel.NEW);
    assert.equal(result.emailItemPersistMetaByThreadId?.thread_carry, undefined);
  });
});
