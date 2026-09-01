import Link from "next/link";
import { restartGmailSyncAction, syncGmailMailboxAction } from "@/app/(dashboard)/inbox/actions";
import { buttonClasses } from "@/components/portal/button";
import { FOCUS_RING } from "@/components/portal/focus";
import { InlineNotice, noticeClasses, SURFACE_PANEL } from "@/components/portal/ui";
import type { SyncFreshnessLevel } from "@/lib/gmail/sync-freshness";
import type { ConnectedEmailAccountStatus } from "@prisma/client";

/** Sync freshness is a domain vocabulary; this maps it onto the shared text tones. */
function freshnessClass(level: SyncFreshnessLevel | undefined): string {
  if (level === "overdue" || level === "sync_stuck") return "font-medium text-warning-foreground";
  if (level === "in_progress") return "font-medium text-info-foreground";
  return "text-foreground-subtle";
}

type Mailbox = {
  id: string;
  email: string;
  status: ConnectedEmailAccountStatus;
  lastSyncedAt: Date | null;
  lastError: string | null;
  syncFreshnessLabel: string;
  syncFreshnessLevel: SyncFreshnessLevel;
};

export function InboxToolbar(props: {
  mailboxes: Mailbox[];
  selectedMailboxId: string | null;
  syncEnqueued?: boolean;
  syncQueued?: boolean;
  syncRestarted?: boolean;
  syncStillRunning?: boolean;
  syncError?: string;
}) {
  const {
    mailboxes,
    selectedMailboxId,
    syncEnqueued,
    syncQueued,
    syncRestarted,
    syncStillRunning,
    syncError,
  } = props;
  const selectedMailbox = selectedMailboxId
    ? mailboxes.find((m) => m.id === selectedMailboxId) ?? null
    : null;
  const needsReconnect =
    selectedMailbox?.status === "NEEDS_REAUTH" || selectedMailbox?.status === "REVOKED";
  const syncDisabled = selectedMailbox != null && selectedMailbox.status !== "CONNECTED";
  const syncStuck = selectedMailbox?.syncFreshnessLevel === "sync_stuck";
  const syncActive = selectedMailbox?.syncFreshnessLevel === "in_progress";

  return (
    <div className={`space-y-2 ${SURFACE_PANEL} px-3 py-2.5`}>
      {syncEnqueued ? (
        <InlineNotice tone="success" size="compact">
          Sync queued — processing in the background.
        </InlineNotice>
      ) : null}

      {syncQueued ? (
        <InlineNotice tone="info" size="compact">
          A sync is already in progress for this mailbox.
        </InlineNotice>
      ) : null}

      {syncRestarted ? (
        <InlineNotice tone="success" size="compact">
          Sync restarted — processing in the background.
        </InlineNotice>
      ) : null}

      {syncStillRunning ? (
        <InlineNotice tone="info" size="compact">
          Sync is still running. Try again once it has been active for at least 5 minutes.
        </InlineNotice>
      ) : null}

      {syncError ? (
        <InlineNotice tone="danger" size="compact" role="alert">
          {syncError}
        </InlineNotice>
      ) : null}

      {syncStuck ? (
        <InlineNotice tone="warning" size="compact">
          Sync appears stuck. You can restart it.
        </InlineNotice>
      ) : null}

      {needsReconnect ? (
        <div className={noticeClasses("warning", "compact")}>
          <div className="font-semibold">Gmail connection needs attention</div>
          <p className="mt-1">
            {selectedMailbox?.status === "REVOKED"
              ? "This mailbox was disconnected or revoked."
              : "This mailbox needs to be reconnected before sync and drafts will work reliably."}
            {selectedMailbox?.lastError ? (
              <span className="mt-1 block">{selectedMailbox.lastError}</span>
            ) : null}
          </p>
          <Link
            href="/email"
            className={`mt-2 inline-block rounded-sm font-medium underline ${FOCUS_RING}`}
          >
            Reconnect Gmail
          </Link>
        </div>
      ) : null}

      {!mailboxes.length ? (
        <p className="text-sm text-foreground-muted">
          No Gmail mailboxes connected for this organization yet.{" "}
          <Link
            className={`rounded-sm font-medium text-foreground underline ${FOCUS_RING}`}
            href="/email"
          >
            Connect Gmail
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {mailboxes.map((mailbox) => {
              const active = mailbox.id === selectedMailboxId;
              return (
                <Link
                  key={mailbox.id}
                  href={`/inbox?mailbox=${encodeURIComponent(mailbox.id)}`}
                  aria-current={active ? "true" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${FOCUS_RING} ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {mailbox.email}
                </Link>
              );
            })}
          </div>

          {selectedMailboxId ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs ${freshnessClass(selectedMailbox?.syncFreshnessLevel)}`}>
                {selectedMailbox?.syncFreshnessLabel ?? "Never synced"}
              </span>
              {selectedMailbox?.lastError && !needsReconnect ? (
                <span className="text-xs text-warning-foreground">{selectedMailbox.lastError}</span>
              ) : null}
              {syncStuck ? (
                <form action={restartGmailSyncAction}>
                  <input type="hidden" name="connectedAccountId" value={selectedMailboxId} />
                  <button
                    type="submit"
                    disabled={syncDisabled}
                    className={buttonClasses({ variant: "primary", size: "xs" })}
                  >
                    Restart Sync
                  </button>
                </form>
              ) : (
                <form action={syncGmailMailboxAction}>
                  <input type="hidden" name="connectedAccountId" value={selectedMailboxId} />
                  <button
                    type="submit"
                    disabled={syncDisabled || syncActive}
                    className={buttonClasses({ variant: "primary", size: "xs" })}
                  >
                    {syncActive ? "Syncing…" : "Sync now"}
                  </button>
                </form>
              )}
              <Link
                href="/email"
                className={`rounded-sm text-xs font-medium text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
              >
                Manage
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
