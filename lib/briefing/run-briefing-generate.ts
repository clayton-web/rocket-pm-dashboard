import type { BriefingSlot } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { generateBriefingFromContext } from "@/lib/ai/briefing/generate-briefing";
import type { GenerateBriefingResult } from "@/lib/ai/briefing/generate-briefing";
import {
  auditBriefingCompleted,
  auditBriefingFailed,
  auditBriefingStarted,
} from "@/lib/briefing/briefing-audit";
import { buildBriefingContext } from "@/lib/briefing/briefing-context";
import { collectEmailBriefingCandidates } from "@/lib/briefing/collect-email-candidates";
import { evaluateBriefingEmailFilters } from "@/lib/briefing/briefing-filters";
import { loadBriefingOrgGateContext } from "@/lib/briefing/briefing-gates";
import {
  BRIEFING_DEFAULT_LOOKBACK_HOURS,
  type BriefingContext,
  type BriefingWindow,
} from "@/lib/briefing/briefing-types";
import { calculateBriefingWindow } from "@/lib/briefing/briefing-window";
import {
  completeBriefingRunZeroItems,
  ensureBriefingRun,
  findBriefingRunByWindow,
  markBriefingRunFailed,
  persistBriefingRunOutput,
} from "@/lib/briefing/persist-briefing-run";
import {
  deliverBriefingRunEmailSafely,
  type SendBriefingEmailArgs,
} from "@/lib/briefing/send-briefing-email";

export type RunBriefingGenerateInput = {
  organizationId: string;
  slot: BriefingSlot;
  backgroundJobId?: string | null;
  triggeredByUserId?: string | null;
  windowStart?: Date;
  windowEnd?: Date;
  force?: boolean;
  dryRun?: boolean;
  generateBriefing?: (args: { context: BriefingContext }) => Promise<GenerateBriefingResult>;
  deliverBriefingEmail?: (args: SendBriefingEmailArgs) => Promise<void>;
};

export type RunBriefingGenerateResult =
  | { status: "skipped"; reason: string }
  | {
      status: "dry_run";
      window: BriefingWindow;
      scannedCount: number;
      includedCount: number;
      skippedCount: number;
    }
  | {
      status: "completed";
      briefingRunId: string;
      window: BriefingWindow;
      scannedCount: number;
      includedCount: number;
      skippedCount: number;
      geminiCallCount: number;
      alreadyCompleted: boolean;
    }
  | { status: "failed"; briefingRunId?: string; errorMessage: string };

function resolveLookbackHours(settingsLookback: number): number {
  const fromEnv = Number(process.env.BRIEFING_DEFAULT_LOOKBACK_HOURS ?? "");
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }
  return settingsLookback > 0 ? settingsLookback : BRIEFING_DEFAULT_LOOKBACK_HOURS;
}

async function maybeDeliverBriefingEmail(args: {
  input: RunBriefingGenerateInput;
  briefingRunId: string;
  actorUserId: string;
  itemsIncluded: number;
  alreadyCompleted: boolean;
}): Promise<void> {
  if (args.alreadyCompleted || args.itemsIncluded === 0) return;

  const deliver = args.input.deliverBriefingEmail ?? deliverBriefingRunEmailSafely;
  await deliver({
    briefingRunId: args.briefingRunId,
    organizationId: args.input.organizationId,
    actorUserId: args.actorUserId,
  });
}

export async function runBriefingGenerate(
  input: RunBriefingGenerateInput,
): Promise<RunBriefingGenerateResult> {
  const gate = await loadBriefingOrgGateContext(input.organizationId);
  if (!gate.ok) {
    return { status: "skipped", reason: gate.reason };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true },
  });
  if (!organization) {
    return { status: "skipped", reason: "organization_not_found" };
  }

  const now = input.windowEnd ?? new Date();
  const lastCompletedRun = await prisma.briefingRun.findFirst({
    where: {
      organizationId: input.organizationId,
      slot: input.slot,
      status: "COMPLETED",
    },
    orderBy: { windowEnd: "desc" },
    select: { windowEnd: true },
  });

  const window: BriefingWindow =
    input.windowStart && input.windowEnd
      ? { windowStart: input.windowStart, windowEnd: input.windowEnd }
      : calculateBriefingWindow({
          now,
          lookbackHours: resolveLookbackHours(gate.settings.lookbackHours),
          lastCompletedRun,
        });

  if (!input.force) {
    const existingCompleted = await findBriefingRunByWindow({
      organizationId: input.organizationId,
      slot: input.slot,
      windowEnd: window.windowEnd,
    });
    if (existingCompleted?.status === "COMPLETED") {
      return {
        status: "completed",
        briefingRunId: existingCompleted.id,
        window,
        scannedCount: existingCompleted.threadsScanned,
        includedCount: existingCompleted.itemsIncluded,
        skippedCount: existingCompleted.itemsSkipped,
        geminiCallCount: existingCompleted.geminiCallCount,
        alreadyCompleted: true,
      };
    }
  }

  const candidates = await collectEmailBriefingCandidates({
    organizationId: input.organizationId,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
  });

  const filterResults = await evaluateBriefingEmailFilters(candidates);
  const includedCount = filterResults.filter((result) => result.include).length;
  const skippedCount = candidates.length - includedCount;

  if (input.dryRun) {
    return {
      status: "dry_run",
      window,
      scannedCount: candidates.length,
      includedCount,
      skippedCount,
    };
  }

  let briefingRunId: string | undefined;

  try {
    const run = await ensureBriefingRun({
      organizationId: input.organizationId,
      slot: input.slot,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      backgroundJobId: input.backgroundJobId,
      force: input.force,
    });

    briefingRunId = run.id;

    if (run.alreadyCompleted) {
      const existing = await findBriefingRunByWindow({
        organizationId: input.organizationId,
        slot: input.slot,
        windowEnd: window.windowEnd,
      });
      return {
        status: "completed",
        briefingRunId: run.id,
        window,
        scannedCount: existing?.threadsScanned ?? candidates.length,
        includedCount: existing?.itemsIncluded ?? 0,
        skippedCount: existing?.itemsSkipped ?? skippedCount,
        geminiCallCount: existing?.geminiCallCount ?? 0,
        alreadyCompleted: true,
      };
    }

    const actorUserId =
      input.triggeredByUserId?.trim() ||
      process.env.JOB_PROCESSOR_ACTOR_USER_ID?.trim() ||
      "system";

    await auditBriefingStarted({
      organizationId: input.organizationId,
      actorUserId,
      briefingRunId: run.id,
      slot: input.slot,
      windowStart: window.windowStart.toISOString(),
      windowEnd: window.windowEnd.toISOString(),
    });

    const context = buildBriefingContext({
      organization: { id: organization.id, name: organization.name },
      settings: {
        lookbackHours: gate.settings.lookbackHours,
        timezone: gate.settings.timezone,
        morningLocalTime: gate.settings.morningLocalTime,
        afternoonLocalTime: gate.settings.afternoonLocalTime,
        activeSourceTypes: gate.effectiveActiveSourceTypes,
      },
      slot: input.slot,
      window,
      candidates,
      filterResults,
    });

    if (context.counts.included === 0) {
      await completeBriefingRunZeroItems({
        briefingRunId: run.id,
        scannedCount: candidates.length,
        skippedCount,
        slot: input.slot,
      });

      await auditBriefingCompleted({
        organizationId: input.organizationId,
        actorUserId,
        briefingRunId: run.id,
        itemsIncluded: 0,
        itemsSkipped: skippedCount,
        geminiCallCount: 0,
      });

      return {
        status: "completed",
        briefingRunId: run.id,
        window,
        scannedCount: candidates.length,
        includedCount: 0,
        skippedCount,
        geminiCallCount: 0,
        alreadyCompleted: false,
      };
    }

    const generate = input.generateBriefing ?? ((args) => generateBriefingFromContext(args));
    const generated = await generate({ context });
    const itemsPersisted = await persistBriefingRunOutput({
      briefingRunId: run.id,
      organizationId: input.organizationId,
      output: generated.output,
      context,
      scannedCount: candidates.length,
      skippedCount,
      geminiCallCount: generated.geminiCallCount,
    });

    await auditBriefingCompleted({
      organizationId: input.organizationId,
      actorUserId,
      briefingRunId: run.id,
      itemsIncluded: itemsPersisted,
      itemsSkipped: skippedCount,
      geminiCallCount: generated.geminiCallCount,
    });

    await maybeDeliverBriefingEmail({
      input,
      briefingRunId: run.id,
      actorUserId,
      itemsIncluded: itemsPersisted,
      alreadyCompleted: false,
    });

    return {
      status: "completed",
      briefingRunId: run.id,
      window,
      scannedCount: candidates.length,
      includedCount: itemsPersisted,
      skippedCount,
      geminiCallCount: generated.geminiCallCount,
      alreadyCompleted: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Briefing generation failed.";
    if (briefingRunId) {
      await markBriefingRunFailed({
        briefingRunId,
        errorMessage: message,
        scannedCount: candidates.length,
        skippedCount,
      });
    }
    await auditBriefingFailed({
      organizationId: input.organizationId,
      triggeredByUserId: input.triggeredByUserId ?? null,
      briefingRunId,
      errorMessage: message,
    });
    return { status: "failed", briefingRunId, errorMessage: message };
  }
}
