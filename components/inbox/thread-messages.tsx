import Link from "next/link";
import type { EmailMessage, EmailThread } from "@prisma/client";
import { FOCUS_RING } from "@/components/portal/focus";
import { SURFACE_PANEL } from "@/components/portal/ui";
import { buildGmailThreadUrl } from "@/lib/inbox/gmail-web-url";

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
  const gmailThreadUrl = buildGmailThreadUrl({
    mailboxEmail: thread.connectedAccount.email,
    providerThreadId: thread.providerThreadId,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/inbox?mailbox=${encodeURIComponent(mailboxQuery)}`}
          className={`rounded-sm text-xs font-medium text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
        >
          ← Back to inbox
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-subtle">
          <span>{thread.connectedAccount.email}</span>
          {gmailThreadUrl ? (
            <a
              href={gmailThreadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-sm font-medium text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
            >
              Open in Gmail
            </a>
          ) : null}
        </div>
      </div>

      <div className={`${SURFACE_PANEL} p-4`}>
        <h1 className="text-lg font-semibold text-foreground">{thread.subject?.trim() || "(No subject)"}</h1>
        {thread.participantEmails.length ? (
          <p className="mt-2 text-xs text-foreground-subtle">{thread.participantEmails.join(", ")}</p>
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
              className={`${SURFACE_PANEL} px-4 py-3 text-sm text-foreground`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-xs text-foreground-subtle">
                <div>
                  <span className="font-semibold text-foreground">{message.fromAddr}</span>
                  <span className="mx-2 text-border-strong">·</span>
                  <span>
                    {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(
                      message.sentAt,
                    )}
                  </span>
                  {message.ccAddrs.length ? (
                    <span className="ml-2 text-foreground-subtle">Cc: {message.ccAddrs.join(", ")}</span>
                  ) : null}
                </div>
                <span className="text-[11px] uppercase tracking-wide text-foreground-subtle">
                  {message.isOutbound ? "Outbound" : "Inbound"}
                  {message.isUnread ? " · unread" : ""}
                </span>
              </div>
              <div className="mt-3 max-w-none whitespace-pre-wrap text-sm text-foreground">{preview || "—"}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
