import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { auditJobEnqueued } from "@/lib/jobs/audit";
import { assertJobTypeAllowedForPhase, getJobProcessorActorUserId } from "@/lib/jobs/policy";
import type { EnqueueJobInput } from "@/lib/jobs/types";

export type EnqueueJobResult = {
  jobId: string;
  created: boolean;
};

async function ensureOrganizationAiPolicy(organizationId: string): Promise<void> {
  await prisma.organizationAiPolicy.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}

export async function enqueueJob(input: EnqueueJobInput): Promise<EnqueueJobResult> {
  assertJobTypeAllowedForPhase(input.jobType);

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true },
  });
  if (!org) {
    throw new Error(`Organization not found: ${input.organizationId}`);
  }

  await ensureOrganizationAiPolicy(input.organizationId);

  const existing = await prisma.backgroundJob.findUnique({
    where: {
      organizationId_jobType_idempotencyKey: {
        organizationId: input.organizationId,
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { jobId: existing.id, created: false };
  }

  const payload = input.payload ?? undefined;

  const job = await prisma.backgroundJob.create({
    data: {
      organizationId: input.organizationId,
      jobType: input.jobType,
      idempotencyKey: input.idempotencyKey,
      payload: payload as Prisma.InputJsonValue | undefined,
      triggerSource: input.triggerSource,
      triggeredByUserId: input.triggeredByUserId ?? null,
      priority: input.priority ?? 0,
      scheduledAt: input.scheduledAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 3,
    },
  });

  const actorUserId =
    input.triggeredByUserId ??
    getJobProcessorActorUserId(null);

  await auditJobEnqueued({
    organizationId: input.organizationId,
    actorUserId,
    jobId: job.id,
    jobType: input.jobType,
    idempotencyKey: input.idempotencyKey,
    triggerSource: input.triggerSource,
  });

  return { jobId: job.id, created: true };
}
