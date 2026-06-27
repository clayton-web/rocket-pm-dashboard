import { BriefingSourceType } from "@prisma/client";
import { generateBriefingFromContext } from "@/lib/ai/briefing/generate-briefing";
import { buildBriefingContext } from "@/lib/briefing/briefing-context";
import { collectEmailBriefingCandidates } from "@/lib/briefing/collect-email-candidates";
import { evaluateBriefingEmailFilters } from "@/lib/briefing/briefing-filters";
import type {
  BriefingSourceModule,
  BriefingSourceResult,
  BriefingSourceRunContext,
} from "@/lib/briefing/sources/types";

export type EmailBriefingModuleDeps = {
  collectCandidates?: typeof collectEmailBriefingCandidates;
  evaluateFilters?: typeof evaluateBriefingEmailFilters;
  buildContext?: typeof buildBriefingContext;
  generateBriefing?: typeof generateBriefingFromContext;
};

function emptyEmailResult(
  args: Pick<BriefingSourceResult, "scannedCount" | "skippedCount" | "includedCount"> & {
    context?: BriefingSourceResult["context"];
  },
): BriefingSourceResult {
  return {
    sourceType: BriefingSourceType.EMAIL,
    scannedCount: args.scannedCount,
    skippedCount: args.skippedCount,
    includedCount: args.includedCount,
    geminiCallCount: 0,
    warnings: [],
    moduleExecutiveLine: null,
    output: null,
    context: args.context ?? null,
  };
}

export async function collectEmailBriefingSource(
  ctx: BriefingSourceRunContext,
  deps: EmailBriefingModuleDeps = {},
): Promise<BriefingSourceResult> {
  const collectCandidates = deps.collectCandidates ?? collectEmailBriefingCandidates;
  const evaluateFilters = deps.evaluateFilters ?? evaluateBriefingEmailFilters;
  const buildContext = deps.buildContext ?? buildBriefingContext;

  const candidates = await collectCandidates({
    organizationId: ctx.organizationId,
    windowStart: ctx.window.windowStart,
    windowEnd: ctx.window.windowEnd,
  });

  const filterResults = await evaluateFilters(candidates);
  const includedCount = filterResults.filter((result) => result.include).length;
  const skippedCount = candidates.length - includedCount;

  const context = buildContext({
    organization: ctx.organization,
    settings: ctx.settings,
    slot: ctx.slot,
    window: ctx.window,
    candidates,
    filterResults,
  });

  if (ctx.dryRun || context.counts.included === 0) {
    return emptyEmailResult({
      scannedCount: candidates.length,
      skippedCount,
      includedCount: context.counts.included,
      context,
    });
  }

  const generate = ctx.generateBriefing ?? deps.generateBriefing ?? generateBriefingFromContext;
  const generated = await generate({ context });

  return {
    sourceType: BriefingSourceType.EMAIL,
    scannedCount: candidates.length,
    skippedCount,
    includedCount: context.counts.included,
    geminiCallCount: generated.geminiCallCount,
    warnings: generated.output.warnings,
    moduleExecutiveLine: null,
    output: generated.output,
    context,
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
