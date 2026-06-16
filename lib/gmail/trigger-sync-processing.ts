import { after } from "next/server";
import type { EnqueueGmailSyncResult } from "@/lib/gmail/enqueue-gmail-sync";
import type { RestartGmailSyncResult } from "@/lib/gmail/restart-gmail-sync";
import { processClaimedJobs } from "@/lib/jobs/processor";

export type PromptSyncAfterScheduler = (callback: () => void | Promise<void>) => void;

/**
 * Claim and run at most one pending background job (typically the just-enqueued gmail.sync).
 */
export async function triggerPromptGmailSyncProcessing(): Promise<void> {
  await processClaimedJobs({ limit: 1 });
}

export function schedulePromptGmailSyncProcessing(args?: {
  scheduleAfter?: PromptSyncAfterScheduler;
}): void {
  const scheduleAfter = args?.scheduleAfter ?? after;

  scheduleAfter(async () => {
    try {
      await triggerPromptGmailSyncProcessing();
    } catch (error) {
      console.error("[gmail] prompt sync processing failed:", error);
    }
  });
}

export function applyPromptSyncAfterEnqueue(
  result: Pick<EnqueueGmailSyncResult, "alreadyQueued">,
  deps?: { schedule?: () => void },
): void {
  if (result.alreadyQueued) return;
  (deps?.schedule ?? schedulePromptGmailSyncProcessing)();
}

export function applyPromptSyncAfterRestart(
  result: RestartGmailSyncResult,
  deps?: { schedule?: () => void },
): void {
  if (!result.restarted) return;
  (deps?.schedule ?? schedulePromptGmailSyncProcessing)();
}
