import Link from "next/link";

type ThreadRow = {
  id: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: Date | null;
  isUnread: boolean;
  participantEmails: string[];
};

export function ThreadList(props: {
  mailboxId: string;
  threads: ThreadRow[];
}) {
  const { threads, mailboxId } = props;

  if (!threads.length) {
    return (
      <p className="text-sm text-neutral-600">
        No threads synced yet. Choose a mailbox above and run <span className="font-medium">Sync now</span>.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <ul className="divide-y divide-neutral-100">
        {threads.map((thread) => (
          <li key={thread.id}>
            <Link
              href={`/inbox/${encodeURIComponent(thread.id)}?mailbox=${encodeURIComponent(mailboxId)}`}
              className="block px-4 py-3 hover:bg-neutral-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`truncate text-sm ${thread.isUnread ? "font-semibold text-neutral-900" : "font-medium text-neutral-800"}`}>
                    {thread.subject?.trim() || "(No subject)"}
                  </div>
                  <div className="truncate text-xs text-neutral-500">{thread.snippet}</div>
                  {thread.participantEmails.length ? (
                    <div className="mt-1 truncate text-[11px] text-neutral-400">
                      {thread.participantEmails.slice(0, 4).join(", ")}
                      {thread.participantEmails.length > 4 ? "…" : ""}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-[11px] text-neutral-400">
                  {thread.lastMessageAt
                    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(thread.lastMessageAt)
                    : ""}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
