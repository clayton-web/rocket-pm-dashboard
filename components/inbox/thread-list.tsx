import { InboxThreadRow } from "@/components/inbox/inbox-thread-row";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";

export function ThreadList(props: {
  mailboxId: string;
  threads: InboxThreadDisplayRow[];
  lastSyncedAt: Date | null;
  emptyMessage?: string;
}) {
  const { threads, mailboxId, lastSyncedAt, emptyMessage } = props;

  if (!threads.length) {
    if (lastSyncedAt == null) {
      return (
        <p className="text-sm text-neutral-600">
          This mailbox has not been synced yet. Run <span className="font-medium">Sync now</span> above to pull recent
          Gmail threads into Rocket PM.
        </p>
      );
    }

    return (
      <p className="text-sm text-neutral-600">
        {emptyMessage ??
          "No threads in this inbox right now. Try Sync now again if you expect new mail, or check the thread in Gmail directly."}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <ul className="divide-y divide-neutral-100">
        {threads.map((thread) => (
          <li key={thread.id}>
            <InboxThreadRow row={thread} mailboxId={mailboxId} />
          </li>
        ))}
      </ul>
    </div>
  );
}
