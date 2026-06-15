import Link from "next/link";
import { syncGmailMailboxAction } from "@/app/(dashboard)/inbox/actions";
import type { SyncFreshnessLevel } from "@/lib/gmail/sync-freshness";
import type { ConnectedEmailAccountStatus } from "@prisma/client";

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
  syncError?: string;
}) {
  const { mailboxes, selectedMailboxId, syncEnqueued, syncQueued, syncError } = props;
  const selectedMailbox = selectedMailboxId
    ? mailboxes.find((m) => m.id === selectedMailboxId) ?? null
    : null;
  const needsReconnect =
    selectedMailbox?.status === "NEEDS_REAUTH" || selectedMailbox?.status === "REVOKED";
  const syncDisabled = selectedMailbox != null && selectedMailbox.status !== "CONNECTED";

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
      {syncEnqueued ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Sync queued — processing in the background.
        </div>
      ) : null}

      {syncQueued ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          A sync is already in progress for this mailbox.
        </div>
      ) : null}

      {syncError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {syncError}
        </div>
      ) : null}

      {needsReconnect ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <div className="font-semibold">Gmail connection needs attention</div>
          <p className="mt-1">
            {selectedMailbox?.status === "REVOKED"
              ? "This mailbox was disconnected or revoked."
              : "This mailbox needs to be reconnected before sync and drafts will work reliably."}
            {selectedMailbox?.lastError ? (
              <span className="mt-1 block text-amber-900">{selectedMailbox.lastError}</span>
            ) : null}
          </p>
          <Link href="/email" className="mt-2 inline-block font-medium text-amber-950 underline">
            Reconnect Gmail
          </Link>
        </div>
      ) : null}

      {!mailboxes.length ? (
        <p className="text-sm text-neutral-600">
          No Gmail mailboxes connected for this organization yet.{" "}
          <Link className="font-medium text-neutral-900 underline" href="/email">
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
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {mailbox.email}
                </Link>
              );
            })}
          </div>

          {selectedMailboxId ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs ${
                  selectedMailbox?.syncFreshnessLevel === "overdue"
                    ? "font-medium text-amber-800"
                    : selectedMailbox?.syncFreshnessLevel === "in_progress"
                      ? "font-medium text-sky-800"
                      : "text-neutral-500"
                }`}
              >
                {selectedMailbox?.syncFreshnessLabel ?? "Never synced"}
              </span>
              {selectedMailbox?.lastError && !needsReconnect ? (
                <span className="text-xs text-amber-800">{selectedMailbox.lastError}</span>
              ) : null}
              <form action={syncGmailMailboxAction}>
                <input type="hidden" name="connectedAccountId" value={selectedMailboxId} />
                <button
                  type="submit"
                  disabled={syncDisabled || selectedMailbox?.syncFreshnessLevel === "in_progress"}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedMailbox?.syncFreshnessLevel === "in_progress" ? "Syncing…" : "Sync now"}
                </button>
              </form>
              <Link href="/email" className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
                Manage
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
