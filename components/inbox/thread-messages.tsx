import Link from "next/link";
import type { EmailMessage, EmailThread } from "@prisma/client";

type Thread = EmailThread & {
  messages: EmailMessage[];
  connectedAccount: { email: string };
};

function htmlToPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ThreadMessages(props: { thread: Thread; mailboxQuery: string }) {
  const { thread, mailboxQuery } = props;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/inbox?mailbox=${encodeURIComponent(mailboxQuery)}`}
          className="text-xs font-medium text-neutral-700 hover:text-neutral-900"
        >
          ← Back to inbox
        </Link>
        <div className="text-xs text-neutral-500">{thread.connectedAccount.email}</div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-neutral-900">{thread.subject?.trim() || "(No subject)"}</h1>
        {thread.participantEmails.length ? (
          <p className="mt-2 text-xs text-neutral-500">{thread.participantEmails.join(", ")}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        {thread.messages.map((message) => {
          const preview =
            message.bodyText?.trim() ||
            (message.bodyHtml ? htmlToPlainText(message.bodyHtml) : "") ||
            "";

          return (
            <article
              key={message.id}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2 text-xs text-neutral-500">
                <div>
                  <span className="font-semibold text-neutral-800">{message.fromAddr}</span>
                  <span className="mx-2 text-neutral-300">·</span>
                  <span>
                    {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(
                      message.sentAt,
                    )}
                  </span>
                  {message.ccAddrs.length ? (
                    <span className="ml-2 text-neutral-400">Cc: {message.ccAddrs.join(", ")}</span>
                  ) : null}
                </div>
                <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                  {message.isOutbound ? "Outbound" : "Inbound"}
                  {message.isUnread ? " · unread" : ""}
                </span>
              </div>
              <div className="mt-3 max-w-none whitespace-pre-wrap text-sm text-neutral-900">{preview || "—"}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
