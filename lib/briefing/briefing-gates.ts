import { BriefingSourceType } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import {
  BRIEFING_MVP_ACTIVE_SOURCE_TYPES,
  isMvpActiveBriefingSourceType,
} from "@/lib/briefing/briefing-sources";
import { isBriefingAutomationEnabled } from "@/lib/jobs/policy";

export type BriefingOrgSettings = {
  enabled: boolean;
  morningEnabled: boolean;
  afternoonEnabled: boolean;
  activeSourceTypes: BriefingSourceType[];
  autoSyncBeforeBriefing: boolean;
  lookbackHours: number;
  timezone: string;
  morningLocalTime: string;
  afternoonLocalTime: string;
  emailRecipients: string[];
};

export type BriefingOrgPolicy = {
  autoBriefingEnabled: boolean;
  maxBriefingRunsPerDay: number;
  maxBriefingGeminiCallsPerRun: number;
};

export type BriefingGateFailure = {
  ok: false;
  reason: string;
};

export type BriefingGateSuccess = {
  ok: true;
  settings: BriefingOrgSettings;
  policy: BriefingOrgPolicy;
  effectiveActiveSourceTypes: BriefingSourceType[];
};

export type BriefingGateResult = BriefingGateFailure | BriefingGateSuccess;

export function resolveMvpActiveSourceTypes(
  activeSourceTypes: BriefingSourceType[],
): BriefingSourceType[] {
  return activeSourceTypes.filter((sourceType) => isMvpActiveBriefingSourceType(sourceType));
}

export function isEmailBriefingSourceActive(activeSourceTypes: BriefingSourceType[]): boolean {
  return resolveMvpActiveSourceTypes(activeSourceTypes).includes(BriefingSourceType.EMAIL);
}

export function checkBriefingEnvironmentGate(): BriefingGateFailure | { ok: true } {
  if (!isBriefingAutomationEnabled()) {
    return { ok: false, reason: "briefing_automation_disabled" };
  }
  return { ok: true };
}

export function checkBriefingOrgGates(args: {
  settings: BriefingOrgSettings | null;
  policy: BriefingOrgPolicy | null;
}): BriefingGateResult {
  const envGate = checkBriefingEnvironmentGate();
  if (!envGate.ok) return envGate;

  if (!args.settings?.enabled) {
    return { ok: false, reason: "briefing_settings_disabled" };
  }

  if (!args.policy?.autoBriefingEnabled) {
    return { ok: false, reason: "auto_briefing_disabled" };
  }

  const effectiveActiveSourceTypes = resolveMvpActiveSourceTypes(
    args.settings.activeSourceTypes,
  );

  if (!effectiveActiveSourceTypes.includes(BriefingSourceType.EMAIL)) {
    return { ok: false, reason: "email_source_inactive" };
  }

  return {
    ok: true,
    settings: args.settings,
    policy: args.policy,
    effectiveActiveSourceTypes,
  };
}

export async function loadBriefingOrgGateContext(
  organizationId: string,
): Promise<BriefingGateResult> {
  const [settings, policy] = await Promise.all([
    prisma.briefingSettings.findUnique({ where: { organizationId } }),
    prisma.organizationAiPolicy.findUnique({ where: { organizationId } }),
  ]);

  return checkBriefingOrgGates({
    settings: settings
      ? {
          enabled: settings.enabled,
          morningEnabled: settings.morningEnabled,
          afternoonEnabled: settings.afternoonEnabled,
          activeSourceTypes: settings.activeSourceTypes,
          autoSyncBeforeBriefing: settings.autoSyncBeforeBriefing,
          lookbackHours: settings.lookbackHours,
          timezone: settings.timezone,
          morningLocalTime: settings.morningLocalTime,
          afternoonLocalTime: settings.afternoonLocalTime,
          emailRecipients: settings.emailRecipients,
        }
      : null,
    policy: policy
      ? {
          autoBriefingEnabled: policy.autoBriefingEnabled,
          maxBriefingRunsPerDay: policy.maxBriefingRunsPerDay,
          maxBriefingGeminiCallsPerRun: policy.maxBriefingGeminiCallsPerRun,
        }
      : null,
  });
}

export type EligibleBriefingOrganization = {
  organizationId: string;
  settings: BriefingOrgSettings;
};

export async function listEligibleBriefingOrganizations(args?: {
  organizationId?: string;
}): Promise<EligibleBriefingOrganization[]> {
  const settingsRows = await prisma.briefingSettings.findMany({
    where: {
      enabled: true,
      ...(args?.organizationId ? { organizationId: args.organizationId } : {}),
    },
    select: {
      organizationId: true,
      enabled: true,
      morningEnabled: true,
      afternoonEnabled: true,
      activeSourceTypes: true,
      autoSyncBeforeBriefing: true,
      lookbackHours: true,
      timezone: true,
      morningLocalTime: true,
      afternoonLocalTime: true,
      emailRecipients: true,
    },
  });

  if (settingsRows.length === 0) return [];

  const policies = await prisma.organizationAiPolicy.findMany({
    where: {
      organizationId: { in: settingsRows.map((row) => row.organizationId) },
      autoBriefingEnabled: true,
    },
    select: { organizationId: true },
  });

  const enabledPolicyOrgIds = new Set(policies.map((row) => row.organizationId));

  const eligible: EligibleBriefingOrganization[] = [];

  for (const settings of settingsRows) {
    if (!enabledPolicyOrgIds.has(settings.organizationId)) continue;
    if (!isEmailBriefingSourceActive(settings.activeSourceTypes)) continue;

    eligible.push({
      organizationId: settings.organizationId,
      settings: {
        enabled: settings.enabled,
        morningEnabled: settings.morningEnabled,
        afternoonEnabled: settings.afternoonEnabled,
        activeSourceTypes: resolveMvpActiveSourceTypes(settings.activeSourceTypes),
        autoSyncBeforeBriefing: settings.autoSyncBeforeBriefing,
        lookbackHours: settings.lookbackHours,
        timezone: settings.timezone,
        morningLocalTime: settings.morningLocalTime,
        afternoonLocalTime: settings.afternoonLocalTime,
        emailRecipients: settings.emailRecipients,
      },
    });
  }

  return eligible;
}

export function isBriefingSlotEnabled(
  settings: Pick<BriefingOrgSettings, "morningEnabled" | "afternoonEnabled">,
  slot: "MORNING" | "AFTERNOON",
): boolean {
  return slot === "MORNING" ? settings.morningEnabled : settings.afternoonEnabled;
}

export function getConfiguredBriefingActiveSourceTypes(): readonly BriefingSourceType[] {
  return BRIEFING_MVP_ACTIVE_SOURCE_TYPES;
}
