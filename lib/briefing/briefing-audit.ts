import type { Prisma } from "@prisma/client";
import type { BriefingSlot } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getJobProcessorActorUserId } from "@/lib/jobs/policy";

export async function auditBriefingStarted(args: {
  organizationId: string;
  actorUserId: string;
  briefingRunId: string;
  slot: BriefingSlot;
  windowStart: string;
  windowEnd: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "briefing.started",
      resourceType: "BriefingRun",
      resourceId: args.briefingRunId,
      metadata: {
        slot: args.slot,
        windowStart: args.windowStart,
        windowEnd: args.windowEnd,
      } satisfies Prisma.InputJsonValue,
    },
  });
}

export async function auditBriefingCompleted(args: {
  organizationId: string;
  actorUserId: string;
  briefingRunId: string;
  itemsIncluded: number;
  itemsSkipped: number;
  geminiCallCount: number;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "briefing.completed",
      resourceType: "BriefingRun",
      resourceId: args.briefingRunId,
      metadata: {
        itemsIncluded: args.itemsIncluded,
        itemsSkipped: args.itemsSkipped,
        geminiCallCount: args.geminiCallCount,
      } satisfies Prisma.InputJsonValue,
    },
  });
}

export async function auditBriefingFailed(args: {
  organizationId: string;
  triggeredByUserId: string | null | undefined;
  briefingRunId?: string;
  errorMessage: string;
}): Promise<void> {
  const actorUserId = getJobProcessorActorUserId(args.triggeredByUserId);
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId,
      action: "briefing.failed",
      resourceType: "BriefingRun",
      resourceId: args.briefingRunId ?? null,
      metadata: {
        errorMessage: args.errorMessage.slice(0, 500),
      } satisfies Prisma.InputJsonValue,
    },
  });
}

export async function auditBriefingScheduleEnqueued(args: {
  organizationId: string;
  actorUserId: string;
  slot: BriefingSlot;
  generateJobId: string;
  syncJobsEnqueued: number;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "briefing.schedule.enqueued",
      resourceType: "BackgroundJob",
      resourceId: args.generateJobId,
      metadata: {
        slot: args.slot,
        syncJobsEnqueued: args.syncJobsEnqueued,
      } satisfies Prisma.InputJsonValue,
    },
  });
}

export async function auditBriefingEmailSent(args: {
  organizationId: string;
  actorUserId: string;
  briefingRunId: string;
  recipientCount: number;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "briefing.email.sent",
      resourceType: "BriefingRun",
      resourceId: args.briefingRunId,
      metadata: {
        recipientCount: args.recipientCount,
      } satisfies Prisma.InputJsonValue,
    },
  });
}

export async function auditBriefingEmailFailed(args: {
  organizationId: string;
  actorUserId: string;
  briefingRunId: string;
  errorMessage: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "briefing.email.failed",
      resourceType: "BriefingRun",
      resourceId: args.briefingRunId,
      metadata: {
        errorMessage: args.errorMessage.slice(0, 500),
      } satisfies Prisma.InputJsonValue,
    },
  });
}
