import type { ConnectedEmailAccount } from "@prisma/client";
import {
  auditGmailSyncCompleted,
  auditGmailSyncFailed,
  auditGmailSyncStarted,
} from "@/lib/gmail/gmail-sync-audit";
import {
  recordGmailSyncFailure,
  runGmailMailboxSync,
  type GmailSyncResult,
} from "@/lib/gmail/gmail-sync-core";

export { getSyncLabelIds, getSyncMaxThreads } from "@/lib/gmail/gmail-sync-core";

export type ManualSyncResult = GmailSyncResult;

/** Direct (inline) Gmail sync with audit events — prefer enqueueGmailSyncJob for staff UI. */
export async function runManualGmailSync(args: {
  account: ConnectedEmailAccount;
  actorUserId: string;
}): Promise<ManualSyncResult> {
  const { account, actorUserId } = args;

  await auditGmailSyncStarted({
    organizationId: account.organizationId,
    actorUserId,
    connectedAccountId: account.id,
  });

  try {
    const result = await runGmailMailboxSync({ account });

    await auditGmailSyncCompleted({
      organizationId: account.organizationId,
      actorUserId,
      connectedAccountId: account.id,
      threadCount: result.threadCount,
      messageCount: result.messageCount,
    });

    return result;
  } catch (error) {
    const message = await recordGmailSyncFailure({ accountId: account.id, error });

    await auditGmailSyncFailed({
      organizationId: account.organizationId,
      actorUserId,
      connectedAccountId: account.id,
      message,
    });

    throw error;
  }
}
