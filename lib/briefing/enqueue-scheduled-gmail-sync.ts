import {
  enqueueScheduledGmailSyncForConnectedAccounts,
  type EnqueueScheduledGmailSyncDeps,
} from "@/lib/gmail/enqueue-scheduled-gmail-sync";

const BRIEFING_SYNC_DELAY_MS = 5 * 60 * 1000;

/**
 * Briefing-owned wrapper around the independent scheduled Gmail enqueue.
 * Still used while Daily Briefing remains enabled; later decommission drops this caller.
 */
export async function enqueueScheduledGmailSyncForBriefing(
  args: {
    organizationId: string;
    actorUserId: string;
  },
  deps: EnqueueScheduledGmailSyncDeps = {},
): Promise<{ enqueued: number; jobIds: string[] }> {
  const result = await enqueueScheduledGmailSyncForConnectedAccounts(
    {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
    },
    deps,
  );

  return { enqueued: result.enqueued, jobIds: result.jobIds };
}

export function getBriefingGenerateDelayAfterSync(): number {
  return BRIEFING_SYNC_DELAY_MS;
}

export { BRIEFING_SYNC_DELAY_MS };
