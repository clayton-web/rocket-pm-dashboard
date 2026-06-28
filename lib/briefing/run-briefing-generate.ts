import type { BriefingSlot } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import type { GenerateBriefingResult } from "@/lib/ai/briefing/generate-briefing";
import {
  auditBriefingCompleted,
  auditBriefingFailed,
  auditBriefingStarted,
} from "@/lib/briefing/briefing-audit";
import { loadBriefingOrgGateContext } from "@/lib/briefing/briefing-gates";
import {
  BRIEFING_DEFAULT_LOOKBACK_HOURS,
  type BriefingContext,
  type BriefingWindow,
} from "@/lib/briefing/briefing-types";
import { calculateBriefingWindow } from "@/lib/briefing/briefing-window";
import {
  applyExecutiveSummaryToOutput,
  composeExecutiveSummary,
} from "@/lib/briefing/compose-executive-summary";
import {
  completeBriefingRunZeroItems,
  ensureBriefingRun,
  findBriefingRunByWindow,
  markBriefingRunFailed,
  persistBriefingRunOutput,
} from "@/lib/briefing/persist-briefing-run";
import { mergeSourceResults } from "@/lib/briefing/sources/merge-source-results";
import {
  BRIEFING_SOURCE_MODULES,
  resolveEnabledBriefingModules,
  runBriefingSourceModules,
} from "@/lib/briefing/sources/registry";
import type { BriefingSourceModule, BriefingSourceRunContext } from "@/lib/briefing/sources/types";
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
  sourceModules?: readonly BriefingSourceModule[];
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

function buildSourceRunContext(args: {
  input: RunBriefingGenerateInput;
  organization: { id: string; name: string };
  window: BriefingWindow;
  gateSettings: {
    lookbackHours: number;
    timezone: string;
    morningLocalTime: string;
    afternoonLocalTime: string;
    activeSourceTypes: import("@prisma/client").BriefingSourceType[];
  };
  briefingRunId?: string;
  dryRun?: boolean;
}): BriefingSourceRunContext {
  return {
    organizationId: args.input.organizationId,
    organization: { id: args.organization.id, name: args.organization.name },
    slot: args.input.slot,
    window: args.window,
    settings: {
      lookbackHours: args.gateSettings.lookbackHours,
      timezone: args.gateSettings.timezone,
      morningLocalTime: args.gateSettings.morningLocalTime,
      afternoonLocalTime: args.gateSettings.afternoonLocalTime,
      activeSourceTypes: args.gateSettings.activeSourceTypes,
    },
    briefingRunId: args.briefingRunId,
    dryRun: args.dryRun,
    generateBriefing: args.input.generateBriefing,
  };
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

  const modules = await resolveEnabledBriefingModules({
    activeSourceTypes: gate.effectiveActiveSourceTypes,
    organizationId: input.organizationId,
    modules: input.sourceModules ?? BRIEFING_SOURCE_MODULES,
  });

  const buildModuleContext = (overrides: Partial<BriefingSourceRunContext> = {}): BriefingSourceRunContext =>
    buildSourceRunContext({
      input,
      organization,
      window,
      gateSettings: {
        lookbackHours: gate.settings.lookbackHours,
        timezone: gate.settings.timezone,
        morningLocalTime: gate.settings.morningLocalTime,
        afternoonLocalTime: gate.settings.afternoonLocalTime,
        activeSourceTypes: gate.effectiveActiveSourceTypes,
      },
      ...overrides,
    });

  if (input.dryRun) {
    const moduleResults = await runBriefingSourceModules(
      modules,
      buildModuleContext({ dryRun: true }),
    );
    const merged = mergeSourceResults(moduleResults);

    return {
      status: "dry_run",
      window,
      scannedCount: merged.scannedCount,
      includedCount: merged.includedCount,
      skippedCount: merged.skippedCount,
    };
  }

  let briefingRunId: string | undefined;
  let mergedForFailure: ReturnType<typeof mergeSourceResults> | undefined;

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
        scannedCount: existing?.threadsScanned ?? 0,
        includedCount: existing?.itemsIncluded ?? 0,
        skippedCount: existing?.itemsSkipped ?? 0,
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

    const moduleResults = await runBriefingSourceModules(
      modules,
      buildModuleContext({ briefingRunId: run.id, dryRun: false }),
    );
    const merged = mergeSourceResults(moduleResults);
    mergedForFailure = merged;

    if (merged.includedCount === 0) {
      await completeBriefingRunZeroItems({
        briefingRunId: run.id,
        scannedCount: merged.scannedCount,
        skippedCount: merged.skippedCount,
        slot: input.slot,
      });

      await auditBriefingCompleted({
        organizationId: input.organizationId,
        actorUserId,
        briefingRunId: run.id,
        itemsIncluded: 0,
        itemsSkipped: merged.skippedCount,
        geminiCallCount: 0,
      });

      return {
        status: "completed",
        briefingRunId: run.id,
        window,
        scannedCount: merged.scannedCount,
        includedCount: 0,
        skippedCount: merged.skippedCount,
        geminiCallCount: 0,
        alreadyCompleted: false,
      };
    }

    if (!merged.output) {
      throw new Error("Briefing modules reported items but produced no persistable output.");
    }

    const persistContext =
      merged.context ??
      ({
        promptVersion: "daily-briefing-v1",
        organization: { id: organization.id, name: organization.name },
        slot: input.slot,
        window: {
          start: window.windowStart.toISOString(),
          end: window.windowEnd.toISOString(),
        },
        activeSourceTypes: gate.effectiveActiveSourceTypes,
        scopeNote: "",
        counts: { scanned: merged.scannedCount, included: 0, skipped: merged.skippedCount },
        threads: [],
      } satisfies import("@/lib/briefing/briefing-types").BriefingContext);

    const executiveSummary =
      composeExecutiveSummary({ results: moduleResults, output: merged.output }) ??
      merged.output.executiveSummary;

    const output = applyExecutiveSummaryToOutput({
      output: merged.output,
      executiveSummary,
    });

    const itemsPersisted = await persistBriefingRunOutput({
      briefingRunId: run.id,
      organizationId: input.organizationId,
      output,
      context: persistContext,
      scannedCount: merged.scannedCount,
      skippedCount: merged.skippedCount,
      geminiCallCount: merged.geminiCallCount,
      emailItemPersistMetaByThreadId: merged.emailItemPersistMetaByThreadId,
    });

    await auditBriefingCompleted({
      organizationId: input.organizationId,
      actorUserId,
      briefingRunId: run.id,
      itemsIncluded: itemsPersisted,
      itemsSkipped: merged.skippedCount,
      geminiCallCount: merged.geminiCallCount,
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
      scannedCount: merged.scannedCount,
      includedCount: itemsPersisted,
      skippedCount: merged.skippedCount,
      geminiCallCount: merged.geminiCallCount,
      alreadyCompleted: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Briefing generation failed.";
    if (briefingRunId) {
      await markBriefingRunFailed({
        briefingRunId,
        errorMessage: message,
        scannedCount: mergedForFailure?.scannedCount,
        skippedCount: mergedForFailure?.skippedCount,
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
