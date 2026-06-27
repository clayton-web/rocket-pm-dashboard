import type { NormalizedBriefingOutput } from "@/lib/ai/briefing/briefing-output.schema";
import type {
  BriefingSourceResult,
  MergedBriefingSourceResults,
} from "@/lib/briefing/sources/types";

export function mergeSourceResults(results: BriefingSourceResult[]): MergedBriefingSourceResults {
  let scannedCount = 0;
  let skippedCount = 0;
  let includedCount = 0;
  let geminiCallCount = 0;
  const warnings: string[] = [];
  const activeSourceTypes: MergedBriefingSourceResults["activeSourceTypes"] = [];

  let output: NormalizedBriefingOutput | null = null;
  let context: MergedBriefingSourceResults["context"] = null;

  for (const result of results) {
    scannedCount += result.scannedCount;
    skippedCount += result.skippedCount;
    includedCount += result.includedCount;
    geminiCallCount += result.geminiCallCount;
    warnings.push(...result.warnings);
    activeSourceTypes.push(result.sourceType);

    if (result.output) {
      output = result.output;
    }
    if (result.context) {
      context = result.context;
    }
  }

  return {
    scannedCount,
    skippedCount,
    includedCount,
    geminiCallCount,
    warnings,
    activeSourceTypes,
    output,
    context,
  };
}
