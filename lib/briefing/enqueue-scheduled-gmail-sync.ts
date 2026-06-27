import prisma from "@/lib/db/prisma";
import { enqueueGmailSyncJob } from "@/lib/gmail/enqueue-gmail-sync";

const BRIEFING_SYNC_DELAY_MS = 5 * 60 * 1000;

export async function enqueueScheduledGmailSyncForBriefing(args: {
  organizationId: string;
  actorUserId: string;
}): Promise<{ enqueued: number; jobIds: string[] }> {
  const accounts = await prisma.connectedEmailAccount.findMany({
    where: {
      organizationId: args.organizationId,
      status: "CONNECTED",
    },
    select: { id: true },
  });

  const jobIds: string[] = [];
  let enqueued = 0;

  for (const account of accounts) {
    const result = await enqueueGmailSyncJob({
      organizationId: args.organizationId,
      connectedAccountId: account.id,
      triggeredByUserId: args.actorUserId,
      triggerSource: "CRON",
    });
    jobIds.push(result.jobId);
    if (result.created) enqueued += 1;
  }

  return { enqueued, jobIds };
}

export function getBriefingGenerateDelayAfterSync(): number {
  return BRIEFING_SYNC_DELAY_MS;
}

export { BRIEFING_SYNC_DELAY_MS };
