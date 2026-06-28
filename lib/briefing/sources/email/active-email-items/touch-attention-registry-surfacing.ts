import type { EmailThreadBriefingAttention } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import type { UpsertAttentionRegistryDeps } from "@/lib/briefing/sources/email/active-email-items/upsert-attention-registry";

export async function touchAttentionRegistrySurfacing(
  args: {
    organizationId: string;
    emailThreadId: string;
    lastSurfacedRunId: string;
    lastSurfacedAt?: Date;
  },
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
      lastSurfacedRunId: args.lastSurfacedRunId,
      lastSurfacedAt: args.lastSurfacedAt ?? new Date(),
    },
  });
}
