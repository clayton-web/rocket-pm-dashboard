import Link from "next/link";
import { syncGmailMailboxAction } from "@/app/(dashboard)/inbox/actions";
import type { ConnectedEmailAccountStatus } from "@prisma/client";

type Mailbox = {
  id: string;
  email: string;
  status: ConnectedEmailAccountStatus;
  lastSyncedAt: Date | null;
  lastError: string | null;
};

function formatTimestamp(date: Date | null) {
  if (!date) return "Never";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function InboxToolbar(props: {
  mailboxes: Mailbox[];
  selectedMailboxId: string | null;
  syncOk?: boolean;
  syncError?: string;
}) {
  const { mailboxes, selectedMailboxId, syncOk, syncError } = props;

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Mailbox</h2>
          <p className="text-xs text-neutral-500">Sync pulls recent threads from Gmail into this dashboard.</p>
        </div>
        <Link href="/email" className="text-xs font-medium text-neutral-700 hover:text-neutral-900">
          Manage connections
        </Link>
      </div>

      {syncOk ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Sync finished.
        </div>
      ) : null}

      {syncError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {syncError}
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
      )}

      {selectedMailboxId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
          <div className="text-xs text-neutral-500">
            Last sync:{" "}
            <span className="text-neutral-700">
              {formatTimestamp(mailboxes.find((m) => m.id === selectedMailboxId)?.lastSyncedAt ?? null)}
            </span>
            {mailboxes.find((m) => m.id === selectedMailboxId)?.lastError ? (
              <span className="ml-2 text-amber-800">
                {mailboxes.find((m) => m.id === selectedMailboxId)?.lastError}
              </span>
            ) : null}
          </div>
          <form action={syncGmailMailboxAction}>
            <input type="hidden" name="connectedAccountId" value={selectedMailboxId} />
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
            >
              Sync now
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
