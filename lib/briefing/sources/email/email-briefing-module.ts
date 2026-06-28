import { BriefingSourceType } from "@prisma/client";
import { flattenBriefingOutputItems } from "@/lib/ai/briefing/briefing-output.schema";
import { generateBriefingFromContext } from "@/lib/ai/briefing/generate-briefing";
import { buildBriefingContext } from "@/lib/briefing/briefing-context";
import { collectEmailBriefingCandidates } from "@/lib/briefing/collect-email-candidates";
import { evaluateBriefingEmailFilters } from "@/lib/briefing/briefing-filters";
import { processActiveEmailAttention } from "@/lib/briefing/sources/email/active-email-items/process-active-attention";
import {
  buildCarryForwardPersistMeta,
  dedupeCarryForwardAgainstWindowThreads,
  mergeEmailBriefingOutput,
} from "@/lib/briefing/sources/email/merge-email-briefing-output";
import { syncEmailAttentionRegistry } from "@/lib/briefing/sources/email/sync-email-attention-registry";
import type {
  BriefingSourceModule,
  BriefingSourceResult,
  BriefingSourceRunContext,
} from "@/lib/briefing/sources/types";
import type { ProcessActiveEmailAttentionDeps } from "@/lib/briefing/sources/email/active-email-items/process-active-attention";

export type EmailBriefingModuleDeps = {
  collectCandidates?: typeof collectEmailBriefingCandidates;
  evaluateFilters?: typeof evaluateBriefingEmailFilters;
  buildContext?: typeof buildBriefingContext;
  generateBriefing?: typeof generateBriefingFromContext;
  processActiveEmailAttention?: typeof processActiveEmailAttention;
  syncEmailAttentionRegistry?: typeof syncEmailAttentionRegistry;
};

function buildIncludedWindowThreadIds(
  candidates: Awaited<ReturnType<typeof collectEmailBriefingCandidates>>,
  filterResults: Awaited<ReturnType<typeof evaluateBriefingEmailFilters>>,
): Set<string> {
  const filterByThreadId = new Map(filterResults.map((result) => [result.threadId, result]));
  const ids = new Set<string>();

  for (const candidate of candidates) {
    const filter = filterByThreadId.get(candidate.id);
    if (filter?.include) {
      ids.add(candidate.id);
    }
  }

  return ids;
}

export async function collectEmailBriefingSource(
  ctx: BriefingSourceRunContext,
  deps: EmailBriefingModuleDeps = {},
): Promise<BriefingSourceResult> {
  const collectCandidates = deps.collectCandidates ?? collectEmailBriefingCandidates;
  const evaluateFilters = deps.evaluateFilters ?? evaluateBriefingEmailFilters;
  const buildContext = deps.buildContext ?? buildBriefingContext;
  const processActive = deps.processActiveEmailAttention ?? processActiveEmailAttention;
  const syncRegistry = deps.syncEmailAttentionRegistry ?? syncEmailAttentionRegistry;

  const activeAttention = await processActive({
    organizationId: ctx.organizationId,
    persistClears: !ctx.dryRun,
  });

  const candidates = await collectCandidates({
    organizationId: ctx.organizationId,
    windowStart: ctx.window.windowStart,
    windowEnd: ctx.window.windowEnd,
  });

  const filterResults = await evaluateFilters(candidates);
  const windowIncludedThreadIds = buildIncludedWindowThreadIds(candidates, filterResults);
  const windowIncludedCount = windowIncludedThreadIds.size;
  const skippedCount = candidates.length - windowIncludedCount;

  const carryForwardRows = dedupeCarryForwardAgainstWindowThreads({
    carryForward: activeAttention.carryForward,
    windowThreadIds: windowIncludedThreadIds,
  });

  const context = buildContext({
    organization: ctx.organization,
    settings: ctx.settings,
    slot: ctx.slot,
    window: ctx.window,
    candidates,
    filterResults,
  });

  const totalIncludedCount = windowIncludedCount + carryForwardRows.length;
  const scannedCount = candidates.length + activeAttention.activeRowsConsidered;

  if (totalIncludedCount === 0) {
    return {
      sourceType: BriefingSourceType.EMAIL,
      scannedCount,
      skippedCount,
      includedCount: 0,
      geminiCallCount: 0,
      warnings: [],
      moduleExecutiveLine: null,
      output: null,
      context,
      emailItemPersistMetaByThreadId: {},
    };
  }

  if (ctx.dryRun) {
    return {
      sourceType: BriefingSourceType.EMAIL,
      scannedCount,
      skippedCount,
      includedCount: totalIncludedCount,
      geminiCallCount: 0,
      warnings: [],
      moduleExecutiveLine:
        carryForwardRows.length > 0
          ? `${carryForwardRows.length} item(s) still need attention from prior briefings.`
          : null,
      output: null,
      context,
      emailItemPersistMetaByThreadId: {},
    };
  }

  let geminiOutput = null;
  let geminiCallCount = 0;
  let warnings: string[] = [];

  if (windowIncludedCount > 0) {
    const generate = ctx.generateBriefing ?? deps.generateBriefing ?? generateBriefingFromContext;
    const generated = await generate({ context });
    geminiOutput = generated.output;
    geminiCallCount = generated.geminiCallCount;
    warnings = generated.output.warnings;
  }

  const mergedOutput = mergeEmailBriefingOutput({
    geminiOutput,
    carryForwardRows,
    windowIncludedCount,
    scannedCount,
    skippedCount,
  });

  const emailItemPersistMetaByThreadId: Record<string, ReturnType<typeof buildCarryForwardPersistMeta>> =
    {};

  for (const row of carryForwardRows) {
    emailItemPersistMetaByThreadId[row.emailThreadId] = buildCarryForwardPersistMeta(row);
  }

  if (ctx.briefingRunId) {
    const geminiItems = geminiOutput ? flattenBriefingOutputItems(geminiOutput) : [];
    const newWindowMeta = await syncRegistry({
      organizationId: ctx.organizationId,
      briefingRunId: ctx.briefingRunId,
      geminiItems,
      context,
      candidates,
      carryForwardRows,
    });
    Object.assign(emailItemPersistMetaByThreadId, newWindowMeta);
  }

  return {
    sourceType: BriefingSourceType.EMAIL,
    scannedCount,
    skippedCount,
    includedCount: mergedOutput.includedCount,
    geminiCallCount,
    warnings,
    moduleExecutiveLine:
      carryForwardRows.length > 0
        ? `${carryForwardRows.length} item(s) still need attention from prior briefings.`
        : null,
    output: mergedOutput,
    context,
    emailItemPersistMetaByThreadId,
  };
}

export const emailBriefingModule: BriefingSourceModule = {
  sourceType: BriefingSourceType.EMAIL,
  moduleId: "email",
  async isAvailable(): Promise<boolean> {
    return true;
  },
  collect(ctx: BriefingSourceRunContext): Promise<BriefingSourceResult> {
    return collectEmailBriefingSource(ctx);
  },
};

export type { ProcessActiveEmailAttentionDeps };
