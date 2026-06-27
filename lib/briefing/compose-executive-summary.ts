import type { NormalizedBriefingOutput } from "@/lib/ai/briefing/briefing-output.schema";
import type { BriefingSourceResult } from "@/lib/briefing/sources/types";

/**
 * Builds the run-level executive summary from module contributions.
 * MVP: preserves Gemini email summary when present (behavior parity).
 */
export function composeExecutiveSummary(args: {
  results: BriefingSourceResult[];
  output: NormalizedBriefingOutput | null;
}): string | null {
  if (args.output?.executiveSummary) {
    return args.output.executiveSummary;
  }

  const moduleLines = args.results
    .map((result) => result.moduleExecutiveLine)
    .filter((line): line is string => Boolean(line?.trim()));

  if (moduleLines.length > 0) {
    return moduleLines.join(" ");
  }

  return null;
}

export function applyExecutiveSummaryToOutput(args: {
  output: NormalizedBriefingOutput;
  executiveSummary: string;
}): NormalizedBriefingOutput {
  return {
    ...args.output,
    executiveSummary: args.executiveSummary,
  };
}
