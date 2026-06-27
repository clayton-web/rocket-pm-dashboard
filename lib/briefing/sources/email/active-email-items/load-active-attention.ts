import type { EmailThreadBriefingAttention, Prisma } from "@prisma/client";
import { BriefingAttentionStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";

export type LoadActiveAttentionRowsArgs = {
  organizationId: string;
  emailThreadIds?: string[];
};

export type LoadActiveAttentionRowsDeps = {
  findMany?: typeof prisma.emailThreadBriefingAttention.findMany;
};

/**
 * Loads unresolved ACTIVE attention registry rows for an organization.
 * Used by future email briefing carry-forward — not wired to generate yet.
 */
export async function loadActiveAttentionRows(
  args: LoadActiveAttentionRowsArgs,
  deps: LoadActiveAttentionRowsDeps = {},
): Promise<EmailThreadBriefingAttention[]> {
  const findMany = deps.findMany ?? prisma.emailThreadBriefingAttention.findMany;

  const where: Prisma.EmailThreadBriefingAttentionWhereInput = {
    organizationId: args.organizationId,
    status: BriefingAttentionStatus.ACTIVE,
    ...(args.emailThreadIds && args.emailThreadIds.length > 0
      ? { emailThreadId: { in: args.emailThreadIds } }
      : {}),
  };

  return findMany({
    where,
    orderBy: [{ firstSurfacedAt: "asc" }, { id: "asc" }],
  });
}
