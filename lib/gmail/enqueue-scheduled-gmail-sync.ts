import prisma from "@/lib/db/prisma";
import { enqueueGmailSyncJob, type EnqueueGmailSyncResult } from "@/lib/gmail/enqueue-gmail-sync";

export type ConnectedGmailAccountRef = {
  id: string;
  organizationId: string;
};

export type ScheduledGmailSyncAccountResult = {
  organizationId: string;
  connectedAccountId: string;
  jobId?: string;
  created?: boolean;
  alreadyQueued?: boolean;
  reason?: string;
};

export type EnqueueScheduledGmailSyncResult = {
  accountsConsidered: number;
  enqueued: number;
  alreadyQueued: number;
  skipped: number;
  jobIds: string[];
  results: ScheduledGmailSyncAccountResult[];
};

export type ListConnectedGmailAccountsForScheduledSync = (args?: {
  organizationId?: string;
}) => Promise<ConnectedGmailAccountRef[]>;

export type EnqueueScheduledGmailSyncJob = (args: {
  organizationId: string;
  connectedAccountId: string;
  triggeredByUserId: string;
  triggerSource?: "USER" | "CRON" | "SYSTEM";
}) => Promise<EnqueueGmailSyncResult>;

export type EnqueueScheduledGmailSyncDeps = {
  listConnectedAccounts?: ListConnectedGmailAccountsForScheduledSync;
  enqueueSyncJob?: EnqueueScheduledGmailSyncJob;
};

/**
 * Connected Gmail accounts eligible for unattended sync.
 * Selection is account-status only — not Briefing settings, policy, or env flags.
 */
export async function listConnectedGmailAccountsForScheduledSync(args?: {
  organizationId?: string;
}): Promise<ConnectedGmailAccountRef[]> {
  return prisma.connectedEmailAccount.findMany({
    where: {
      status: "CONNECTED",
      ...(args?.organizationId ? { organizationId: args.organizationId } : {}),
    },
    select: { id: true, organizationId: true },
    orderBy: [{ organizationId: "asc" }, { id: "asc" }],
  });
}

/**
 * Enqueue existing gmail.sync jobs for connected accounts.
 * Relies on enqueueGmailSyncJob to skip accounts that already have PENDING/RUNNING sync.
 */
export async function enqueueScheduledGmailSyncForConnectedAccounts(
  args: {
    actorUserId: string;
    organizationId?: string;
    dryRun?: boolean;
  },
  deps: EnqueueScheduledGmailSyncDeps = {},
): Promise<EnqueueScheduledGmailSyncResult> {
  const listConnectedAccounts =
    deps.listConnectedAccounts ?? listConnectedGmailAccountsForScheduledSync;
  const enqueueSyncJob = deps.enqueueSyncJob ?? enqueueGmailSyncJob;

  const accounts = await listConnectedAccounts(
    args.organizationId ? { organizationId: args.organizationId } : undefined,
  );

  let enqueued = 0;
  let alreadyQueued = 0;
  let skipped = 0;
  const jobIds: string[] = [];
  const results: ScheduledGmailSyncAccountResult[] = [];

  for (const account of accounts) {
    if (args.organizationId && account.organizationId !== args.organizationId) {
      skipped += 1;
      results.push({
        organizationId: account.organizationId,
        connectedAccountId: account.id,
        reason: "organization_mismatch",
      });
      continue;
    }

    if (args.dryRun) {
      skipped += 1;
      results.push({
        organizationId: account.organizationId,
        connectedAccountId: account.id,
        reason: "dry_run",
      });
      continue;
    }

    const result = await enqueueSyncJob({
      organizationId: account.organizationId,
      connectedAccountId: account.id,
      triggeredByUserId: args.actorUserId,
      triggerSource: "CRON",
    });

    jobIds.push(result.jobId);
    if (result.created) {
      enqueued += 1;
    } else {
      alreadyQueued += 1;
    }

    results.push({
      organizationId: account.organizationId,
      connectedAccountId: account.id,
      jobId: result.jobId,
      created: result.created,
      alreadyQueued: result.alreadyQueued,
    });
  }

  return {
    accountsConsidered: accounts.length,
    enqueued,
    alreadyQueued,
    skipped,
    jobIds,
    results,
  };
}
