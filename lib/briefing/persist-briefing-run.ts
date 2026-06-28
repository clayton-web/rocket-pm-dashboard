import type { Prisma } from "@prisma/client";
import { BriefingAttentionLabel } from "@prisma/client";
import {
  BriefingItemCategory,
  BriefingItemUrgency,
  BriefingRunStatus,
  BriefingSlot,
  BriefingSourceType,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import type { NormalizedBriefingOutput } from "@/lib/ai/briefing/briefing-output.schema";
import { flattenBriefingOutputItems } from "@/lib/ai/briefing/briefing-output.schema";
import type { BriefingContext } from "@/lib/briefing/briefing-types";
import {
  BRIEFING_DATA_PROVENANCE,
  BRIEFING_MVP_SCOPE_NOTE,
} from "@/lib/briefing/briefing-sources";
import { BRIEFING_ATTENTION_SECTION } from "@/lib/briefing/sources/email/briefing-attention-constants";
import type { BriefingEmailItemPersistMeta } from "@/lib/briefing/sources/types";
import {
  buildOperationsIntelligenceInputFromContextThread,
  buildOperationsIntelligenceInputWithoutThread,
  enrichBriefingEmailSummaryJson,
  parseFirstSurfacedAtFromSummary,
} from "@/lib/briefing/sources/email/enrich-email-operations-summary";

function truncateSubject(subject: string | null | undefined): string | null {
  if (subject == null) return null;
  const trimmed = subject.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 200) return trimmed;
  return `${trimmed.slice(0, 199)}…`;
}

function parseDueDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export type BriefingRunRecord = {
  id: string;
  status: BriefingRunStatus;
  windowStart: Date;
  windowEnd: Date;
  alreadyCompleted: boolean;
};

export async function findBriefingRunByWindow(args: {
  organizationId: string;
  slot: BriefingSlot;
  windowEnd: Date;
}) {
  return prisma.briefingRun.findUnique({
    where: {
      organizationId_slot_windowEnd: {
        organizationId: args.organizationId,
        slot: args.slot,
        windowEnd: args.windowEnd,
      },
    },
  });
}

export async function ensureBriefingRun(args: {
  organizationId: string;
  slot: BriefingSlot;
  windowStart: Date;
  windowEnd: Date;
  backgroundJobId?: string | null;
  force?: boolean;
}): Promise<BriefingRunRecord> {
  const existing = await findBriefingRunByWindow({
    organizationId: args.organizationId,
    slot: args.slot,
    windowEnd: args.windowEnd,
  });

  if (existing?.status === "COMPLETED" && !args.force) {
    return {
      id: existing.id,
      status: existing.status,
      windowStart: existing.windowStart,
      windowEnd: existing.windowEnd,
      alreadyCompleted: true,
    };
  }

  if (existing) {
    const run = await prisma.briefingRun.update({
      where: { id: existing.id },
      data: {
        status: "RUNNING",
        windowStart: args.windowStart,
        errorMessage: null,
        backgroundJobId: args.backgroundJobId ?? existing.backgroundJobId,
      },
    });
    await prisma.briefingItem.deleteMany({ where: { briefingRunId: run.id } });
    return {
      id: run.id,
      status: run.status,
      windowStart: run.windowStart,
      windowEnd: run.windowEnd,
      alreadyCompleted: false,
    };
  }

  const run = await prisma.briefingRun.create({
    data: {
      organizationId: args.organizationId,
      slot: args.slot,
      status: "RUNNING",
      windowStart: args.windowStart,
      windowEnd: args.windowEnd,
      backgroundJobId: args.backgroundJobId ?? null,
    },
  });

  return {
    id: run.id,
    status: run.status,
    windowStart: run.windowStart,
    windowEnd: run.windowEnd,
    alreadyCompleted: false,
  };
}

export function buildZeroItemBriefingJson(args: {
  slot: BriefingSlot;
  scannedCount: number;
  skippedCount: number;
}): Prisma.InputJsonValue {
  return {
    summaryTitle: `Daily Briefing — ${args.slot} — no PM email activity`,
    executiveSummary:
      "No property-management email threads matched the briefing filters for this window.",
    estimatedReadingMinutes: 1,
    scannedCount: args.scannedCount,
    includedCount: 0,
    skippedCount: args.skippedCount,
    sections: [],
    suggestedFollowUpActions: [],
    warnings: [],
    activeSourceTypes: [BriefingSourceType.EMAIL],
    scopeNote: BRIEFING_MVP_SCOPE_NOTE,
  } satisfies Prisma.InputJsonValue;
}

export function buildRunBriefingJson(
  output: NormalizedBriefingOutput,
): Prisma.InputJsonValue {
  return {
    ...output,
    activeSourceTypes: [BriefingSourceType.EMAIL],
    scopeNote: BRIEFING_MVP_SCOPE_NOTE,
  } as Prisma.InputJsonValue;
}

export async function completeBriefingRunZeroItems(args: {
  briefingRunId: string;
  scannedCount: number;
  skippedCount: number;
  slot: BriefingSlot;
}): Promise<void> {
  await prisma.briefingRun.update({
    where: { id: args.briefingRunId },
    data: {
      status: "COMPLETED",
      threadsScanned: args.scannedCount,
      itemsIncluded: 0,
      itemsSkipped: args.skippedCount,
      geminiCallCount: 0,
      briefingJson: buildZeroItemBriefingJson({
        slot: args.slot,
        scannedCount: args.scannedCount,
        skippedCount: args.skippedCount,
      }),
      executiveSummary:
        "No property-management email threads matched the briefing filters for this window.",
      estimatedReadingMinutes: 1,
      errorMessage: null,
    },
  });
}

export async function persistBriefingRunOutput(args: {
  briefingRunId: string;
  organizationId: string;
  output: NormalizedBriefingOutput;
  context: BriefingContext;
  scannedCount: number;
  skippedCount: number;
  geminiCallCount: number;
  emailItemPersistMetaByThreadId?: Record<string, BriefingEmailItemPersistMeta>;
}): Promise<number> {
  const flattened = flattenBriefingOutputItems(args.output);
  const threadById = new Map(args.context.threads.map((thread) => [thread.threadId, thread]));
  const persistMeta = args.emailItemPersistMetaByThreadId ?? {};

  const itemRows = flattened.map((item, index) => {
    const thread = item.sourceThreadId ? threadById.get(item.sourceThreadId) : undefined;
    const threadId = thread?.threadId ?? item.sourceThreadId ?? null;
    const meta =
      threadId && persistMeta[threadId]
        ? persistMeta[threadId]
        : {
            attentionLabel: BriefingAttentionLabel.NEW,
            attentionSection: BRIEFING_ATTENTION_SECTION.NEW_IN_WINDOW,
            emailThreadBriefingAttentionId: null,
            subject: thread?.subject ?? null,
          };

    const baseSummary: Record<string, unknown> = meta.summaryJson
      ? { ...meta.summaryJson }
      : {
          keyFacts: item.keyFacts,
          requiredAction: item.requiredAction ?? null,
          suggestedReplyNotes: item.suggestedReplyNotes ?? null,
          confidence: item.confidence ?? null,
          dataProvenance: BRIEFING_DATA_PROVENANCE.EMAIL_MENTION,
          isPropertyManagementRelated: item.isPropertyManagementRelated,
          sender: thread?.sender ?? null,
          senderEmail: thread?.senderEmail ?? null,
        };

    const referenceDate = new Date(args.context.window.end);
    const firstSurfacedAt =
      parseFirstSurfacedAtFromSummary(baseSummary) ?? referenceDate;

    const operationsInput = thread
      ? buildOperationsIntelligenceInputFromContextThread({
          thread,
          category: item.category as BriefingItemCategory,
          urgency: item.urgency as BriefingItemUrgency,
          attentionSection: meta.attentionSection,
          requiredAction: item.requiredAction ?? null,
        })
      : buildOperationsIntelligenceInputWithoutThread({
          category: item.category as BriefingItemCategory,
          urgency: item.urgency as BriefingItemUrgency,
          attentionSection: meta.attentionSection,
          subject: meta.subject ?? item.summaryTitle,
          senderEmail:
            typeof baseSummary.senderEmail === "string" ? baseSummary.senderEmail : null,
          requiredAction: item.requiredAction ?? null,
          latestMessageIsInbound:
            meta.attentionSection === BRIEFING_ATTENTION_SECTION.STILL_NEEDS_ATTENTION,
        });

    const summaryJson: Prisma.InputJsonValue = enrichBriefingEmailSummaryJson({
      summaryJson: baseSummary,
      operationsInput,
      firstSurfacedAt,
      referenceDate,
    }) as Prisma.InputJsonValue;

    return {
      briefingRunId: args.briefingRunId,
      organizationId: args.organizationId,
      sourceType: BriefingSourceType.EMAIL,
      category: item.category as BriefingItemCategory,
      urgency: item.urgency as BriefingItemUrgency,
      subject: truncateSubject(meta.subject ?? thread?.subject ?? null),
      summaryTitle: item.summaryTitle,
      summaryJson,
      emailThreadId: threadId,
      emailMessageId: thread?.newestMessageId ?? null,
      providerThreadId: thread?.providerThreadId ?? null,
      providerMessageId: thread?.providerMessageId ?? null,
      sourceRecordId: threadId,
      sourceRecordType: "EMAIL_THREAD",
      dueDate: parseDueDate(item.dueDate),
      sortOrder: index,
      attentionLabel: meta.attentionLabel,
      attentionSection: meta.attentionSection,
      emailThreadBriefingAttentionId: meta.emailThreadBriefingAttentionId ?? null,
    };
  });

  if (itemRows.length > 0) {
    await prisma.briefingItem.createMany({ data: itemRows });
  }

  await prisma.briefingRun.update({
    where: { id: args.briefingRunId },
    data: {
      status: "COMPLETED",
      threadsScanned: args.scannedCount,
      itemsIncluded: itemRows.length,
      itemsSkipped: args.skippedCount,
      geminiCallCount: args.geminiCallCount,
      executiveSummary: args.output.executiveSummary,
      estimatedReadingMinutes: args.output.estimatedReadingMinutes,
      confidenceNote:
        args.output.warnings.length > 0 ? args.output.warnings.join(" ") : null,
      briefingJson: buildRunBriefingJson(args.output),
      errorMessage: null,
    },
  });

  return itemRows.length;
}

export async function markBriefingRunFailed(args: {
  briefingRunId: string;
  errorMessage: string;
  scannedCount?: number;
  skippedCount?: number;
}): Promise<void> {
  await prisma.briefingRun.update({
    where: { id: args.briefingRunId },
    data: {
      status: "FAILED",
      errorMessage: args.errorMessage.slice(0, 2000),
      threadsScanned: args.scannedCount,
      itemsSkipped: args.skippedCount,
    },
  });
}
