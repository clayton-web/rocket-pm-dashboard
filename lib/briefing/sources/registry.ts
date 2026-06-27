import type { BriefingSourceType } from "@prisma/client";
import { ownerRentAccountingBriefingModule } from "@/lib/briefing/sources/accounting/owner-rent-accounting-briefing-module";
import { buildingBriefingModule } from "@/lib/briefing/sources/building/building-briefing-module";
import { buildiumBriefingModule } from "@/lib/briefing/sources/buildium/buildium-briefing-module";
import { emailBriefingModule } from "@/lib/briefing/sources/email/email-briefing-module";
import { leasingBriefingModule } from "@/lib/briefing/sources/leasing/leasing-briefing-module";
import { maintenanceBriefingModule } from "@/lib/briefing/sources/maintenance/maintenance-briefing-module";
import type {
  BriefingSourceModule,
  BriefingSourceResult,
  BriefingSourceRunContext,
} from "@/lib/briefing/sources/types";

/** All registered briefing source modules in stable run order. */
export const BRIEFING_SOURCE_MODULES: readonly BriefingSourceModule[] = [
  emailBriefingModule,
  maintenanceBriefingModule,
  buildingBriefingModule,
  leasingBriefingModule,
  ownerRentAccountingBriefingModule,
  buildiumBriefingModule,
] as const;

export function getBriefingSourceModuleByType(
  sourceType: BriefingSourceType,
): BriefingSourceModule | undefined {
  return BRIEFING_SOURCE_MODULES.find((module) => module.sourceType === sourceType);
}

export async function resolveEnabledBriefingModules(args: {
  activeSourceTypes: BriefingSourceType[];
  organizationId: string;
  modules?: readonly BriefingSourceModule[];
}): Promise<BriefingSourceModule[]> {
  const registry = args.modules ?? BRIEFING_SOURCE_MODULES;
  const active = new Set(args.activeSourceTypes);
  const enabled: BriefingSourceModule[] = [];

  for (const briefingModule of registry) {
    if (!active.has(briefingModule.sourceType)) continue;
    if (!(await briefingModule.isAvailable({ organizationId: args.organizationId }))) continue;
    enabled.push(briefingModule);
  }

  return enabled;
}

export async function runBriefingSourceModules(
  modules: readonly BriefingSourceModule[],
  ctx: BriefingSourceRunContext,
): Promise<BriefingSourceResult[]> {
  const results: BriefingSourceResult[] = [];

  for (const briefingModule of modules) {
    results.push(await briefingModule.collect(ctx));
  }

  return results;
}

export function listRegisteredBriefingSourceModuleIds(): string[] {
  return BRIEFING_SOURCE_MODULES.map((module) => module.moduleId);
}
