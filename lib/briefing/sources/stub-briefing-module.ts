import type { BriefingSourceType } from "@prisma/client";
import type { BriefingSourceModule, BriefingSourceResult } from "@/lib/briefing/sources/types";

export function createStubBriefingModule(args: {
  sourceType: BriefingSourceType;
  moduleId: string;
}): BriefingSourceModule {
  const emptyResult = (): BriefingSourceResult => ({
    sourceType: args.sourceType,
    scannedCount: 0,
    skippedCount: 0,
    includedCount: 0,
    geminiCallCount: 0,
    warnings: [],
    moduleExecutiveLine: null,
    output: null,
    context: null,
  });

  return {
    sourceType: args.sourceType,
    moduleId: args.moduleId,
    async isAvailable(): Promise<boolean> {
      return false;
    },
    async collect(): Promise<BriefingSourceResult> {
      return emptyResult();
    },
  };
}
