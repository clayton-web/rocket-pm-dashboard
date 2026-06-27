import type { BriefingSlot } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { resolveMvpActiveSourceTypes } from "@/lib/briefing/briefing-gates";
import type { StaffContext } from "@/lib/services/staff-context";
import { hasOrgWidePropertyRights } from "@/lib/services/property-access";
import { ForbiddenError } from "@/lib/services/errors";

export type BriefingSettingsInput = {
  enabled: boolean;
  morningEnabled: boolean;
  afternoonEnabled: boolean;
  timezone: string;
  morningLocalTime: string;
  afternoonLocalTime: string;
  emailRecipients: string[];
  autoSyncBeforeBriefing: boolean;
  lookbackHours: number;
  autoBriefingEnabled: boolean;
};

function assertCanEditBriefingSettings(ctx: StaffContext): void {
  if (!hasOrgWidePropertyRights(ctx)) {
    throw new ForbiddenError("Organization admin access is required to edit Daily Briefing settings.");
  }
}

export async function upsertBriefingSettings(
  ctx: StaffContext,
  input: BriefingSettingsInput,
): Promise<void> {
  assertCanEditBriefingSettings(ctx);

  await prisma.$transaction([
    prisma.briefingSettings.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        enabled: input.enabled,
        morningEnabled: input.morningEnabled,
        afternoonEnabled: input.afternoonEnabled,
        timezone: input.timezone,
        morningLocalTime: input.morningLocalTime,
        afternoonLocalTime: input.afternoonLocalTime,
        emailRecipients: input.emailRecipients,
        autoSyncBeforeBriefing: input.autoSyncBeforeBriefing,
        lookbackHours: input.lookbackHours,
        activeSourceTypes: resolveMvpActiveSourceTypes([]),
      },
      update: {
        enabled: input.enabled,
        morningEnabled: input.morningEnabled,
        afternoonEnabled: input.afternoonEnabled,
        timezone: input.timezone,
        morningLocalTime: input.morningLocalTime,
        afternoonLocalTime: input.afternoonLocalTime,
        emailRecipients: input.emailRecipients,
        autoSyncBeforeBriefing: input.autoSyncBeforeBriefing,
        lookbackHours: input.lookbackHours,
        activeSourceTypes: resolveMvpActiveSourceTypes([]),
      },
    }),
    prisma.organizationAiPolicy.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        autoBriefingEnabled: input.autoBriefingEnabled,
      },
      update: {
        autoBriefingEnabled: input.autoBriefingEnabled,
      },
    }),
  ]);
}

export async function markBriefingRunReviewed(args: {
  organizationId: string;
  runId: string;
  userId: string;
}): Promise<boolean> {
  const result = await prisma.briefingRun.updateMany({
    where: { id: args.runId, organizationId: args.organizationId },
    data: {
      reviewedAt: new Date(),
      reviewedByUserId: args.userId,
    },
  });
  return result.count > 0;
}

export function inferBriefingSlotFromDate(date: Date = new Date()): BriefingSlot {
  const hour = date.getHours();
  return hour < 12 ? "MORNING" : "AFTERNOON";
}
