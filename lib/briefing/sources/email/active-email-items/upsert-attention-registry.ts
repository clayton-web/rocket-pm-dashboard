import { BriefingAttentionStatus, Prisma, type EmailThreadBriefingAttention } from "@prisma/client";
import { countOutboundMessages } from "@/lib/briefing/sources/email/active-email-items/detect-outbound-reply";
import type { UpsertAttentionRegistryInput } from "@/lib/briefing/sources/email/active-email-items/types";
import prisma from "@/lib/db/prisma";

export type UpsertAttentionRegistryDeps = {
  upsert?: typeof prisma.emailThreadBriefingAttention.upsert;
  update?: typeof prisma.emailThreadBriefingAttention.update;
};

function resolveSurfacedAtOutboundCount(input: UpsertAttentionRegistryInput): number {
  if (input.surfacedAtOutboundCount != null) {
    return input.surfacedAtOutboundCount;
  }

  const firstSurfacedAt = input.firstSurfacedAt ?? new Date();
  if (!input.messages || input.messages.length === 0) {
    return 0;
  }

  return countOutboundMessages({
    messages: input.messages,
    beforeInclusive: firstSurfacedAt,
  });
}

function buildSummaryJson(
  summaryJson: UpsertAttentionRegistryInput["summaryJson"],
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (summaryJson === undefined) return undefined;
  if (summaryJson === null) return Prisma.JsonNull;
  return summaryJson as Prisma.InputJsonValue;
}

/**
 * Creates or updates a thread attention registry row keyed by organizationId + emailThreadId.
 * Idempotent — safe to call when re-surfacing the same thread in a later run.
 */
export async function upsertAttentionRegistry(
  input: UpsertAttentionRegistryInput,
  deps: UpsertAttentionRegistryDeps = {},
): Promise<EmailThreadBriefingAttention> {
  const upsert = deps.upsert ?? prisma.emailThreadBriefingAttention.upsert;
  const firstSurfacedAt = input.firstSurfacedAt ?? new Date();
  const surfacedAtOutboundCount = resolveSurfacedAtOutboundCount(input);
  const summaryJson = buildSummaryJson(input.summaryJson);

  return upsert({
    where: {
      organizationId_emailThreadId: {
        organizationId: input.organizationId,
        emailThreadId: input.emailThreadId,
      },
    },
    create: {
      organizationId: input.organizationId,
      emailThreadId: input.emailThreadId,
      status: BriefingAttentionStatus.ACTIVE,
      firstSurfacedAt,
      lastSurfacedRunId: input.lastSurfacedRunId ?? null,
      lastSurfacedAt: input.lastSurfacedAt ?? firstSurfacedAt,
      summaryTitle: input.summaryTitle,
      category: input.category,
      urgency: input.urgency,
      subject: input.subject ?? null,
      ...(summaryJson !== undefined ? { summaryJson } : {}),
      surfacedAtOutboundCount,
    },
    update: {
      status: BriefingAttentionStatus.ACTIVE,
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionReason: null,
      lastSurfacedRunId: input.lastSurfacedRunId ?? undefined,
      lastSurfacedAt: input.lastSurfacedAt ?? new Date(),
      summaryTitle: input.summaryTitle,
      category: input.category,
      urgency: input.urgency,
      subject: input.subject ?? null,
      ...(summaryJson !== undefined ? { summaryJson } : {}),
    },
  });
}

export type MarkAttentionResolvedArgs = {
  organizationId: string;
  emailThreadId: string;
  resolvedByUserId?: string | null;
  resolutionReason?: string;
  resolvedAt?: Date;
};

/**
 * Staff or system resolution — clears row from future ACTIVE loads.
 */
export async function markAttentionResolved(
  args: MarkAttentionResolvedArgs,
  deps: UpsertAttentionRegistryDeps = {},
): Promise<EmailThreadBriefingAttention> {
  const update = deps.update ?? prisma.emailThreadBriefingAttention.update;

  return update({
    where: {
      organizationId_emailThreadId: {
        organizationId: args.organizationId,
        emailThreadId: args.emailThreadId,
      },
    },
    data: {
      status: BriefingAttentionStatus.RESOLVED,
      resolvedAt: args.resolvedAt ?? new Date(),
      resolvedByUserId: args.resolvedByUserId ?? null,
      resolutionReason: args.resolutionReason ?? "manual",
    },
  });
}

export type ApplyAttentionEvaluationArgs = {
  organizationId: string;
  emailThreadId: string;
  status: BriefingAttentionStatus;
  resolutionReason?: string | null;
  lastOutboundAt?: Date | null;
  resolvedAt?: Date;
};

/**
 * Persists the result of evaluateAttentionStatus when status changes from ACTIVE.
 */
export async function applyAttentionEvaluation(
  args: ApplyAttentionEvaluationArgs,
  deps: UpsertAttentionRegistryDeps = {},
): Promise<EmailThreadBriefingAttention> {
  const update = deps.update ?? prisma.emailThreadBriefingAttention.update;

  const isTerminal =
    args.status === BriefingAttentionStatus.RESOLVED ||
    args.status === BriefingAttentionStatus.REPLIED;

  return update({
    where: {
      organizationId_emailThreadId: {
        organizationId: args.organizationId,
        emailThreadId: args.emailThreadId,
      },
    },
    data: {
      status: args.status,
      lastOutboundAt: args.lastOutboundAt ?? undefined,
      ...(isTerminal
        ? {
            resolvedAt: args.resolvedAt ?? new Date(),
            resolutionReason: args.resolutionReason ?? null,
          }
        : {}),
    },
  });
}
