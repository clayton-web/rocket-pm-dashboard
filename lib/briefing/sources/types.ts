import type { BriefingSourceType } from "@prisma/client";
import type { GenerateBriefingResult } from "@/lib/ai/briefing/generate-briefing";
import type { NormalizedBriefingOutput } from "@/lib/ai/briefing/briefing-output.schema";
import type {
  BriefingContext,
  BriefingOrgSnapshot,
  BriefingSettingsSnapshot,
  BriefingWindow,
} from "@/lib/briefing/briefing-types";
import type { BriefingSlot } from "@prisma/client";

export type BriefingSourceRunContext = {
  organizationId: string;
  organization: BriefingOrgSnapshot;
  slot: BriefingSlot;
  window: BriefingWindow;
  settings: BriefingSettingsSnapshot;
  briefingRunId?: string;
  dryRun?: boolean;
  generateBriefing?: (args: { context: BriefingContext }) => Promise<GenerateBriefingResult>;
};

export type BriefingSourceResult = {
  sourceType: BriefingSourceType;
  scannedCount: number;
  skippedCount: number;
  includedCount: number;
  geminiCallCount: number;
  warnings: string[];
  moduleExecutiveLine: string | null;
  /** Email module populates for persist — stubs leave null. */
  output: NormalizedBriefingOutput | null;
  /** Email module populates for persist — stubs leave null. */
  context: BriefingContext | null;
};

export type MergedBriefingSourceResults = {
  scannedCount: number;
  skippedCount: number;
  includedCount: number;
  geminiCallCount: number;
  warnings: string[];
  activeSourceTypes: BriefingSourceType[];
  output: NormalizedBriefingOutput | null;
  context: BriefingContext | null;
};

export type BriefingSourceModule = {
  readonly sourceType: BriefingSourceType;
  readonly moduleId: string;

  isAvailable(ctx: Pick<BriefingSourceRunContext, "organizationId">): Promise<boolean>;

  collect(ctx: BriefingSourceRunContext): Promise<BriefingSourceResult>;
};
