import type { BackgroundJob } from "@prisma/client";
import prisma from "@/lib/db/prisma";

const DEFAULT_CLAIM_LIMIT = 10;

function clampClaimLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_CLAIM_LIMIT;
  return Math.min(50, Math.max(1, Math.floor(limit)));
}

/**
 * Claim pending jobs using Postgres row locks (SKIP LOCKED).
 * Sets status to RUNNING and records lock metadata.
 */
export async function claimPendingJobs(args: {
  limit?: number;
  workerId: string;
}): Promise<BackgroundJob[]> {
  const limit = clampClaimLimit(args.limit ?? DEFAULT_CLAIM_LIMIT);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<BackgroundJob[]>`
      SELECT *
      FROM "BackgroundJob"
      WHERE "status" = 'PENDING'::"BackgroundJobStatus"
        AND "scheduledAt" <= ${now}
      ORDER BY "priority" DESC, "scheduledAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);

    await tx.backgroundJob.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "RUNNING",
        lockedAt: now,
        lockedBy: args.workerId,
      },
    });

    return tx.backgroundJob.findMany({
      where: { id: { in: ids } },
      orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
    });
  });
}
