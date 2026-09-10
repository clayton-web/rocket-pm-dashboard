import Link from "next/link";
import React from "react";
import { FOCUS_RING } from "@/components/portal/focus";
import type { InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";

function formatLastMessageAtDesktop(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(d);
}

export function formatLastMessageAtMobile(iso: string | null, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfMessageDay = new Date(d);
  startOfMessageDay.setHours(0, 0, 0, 0);

  if (startOfMessageDay.getTime() === startOfToday.getTime()) return "Today";
  if (startOfMessageDay.getTime() === startOfYesterday.getTime()) return "Yesterday";

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

export function formatInboxThreadSubject(subject: string | null | undefined): string {
  return subject?.trim() || "(No subject)";
}

export function shouldEmphasizeInboxThreadRow(row: Pick<InboxThreadDisplayRow, "unreadInbound" | "actionState">): boolean {
  return row.unreadInbound || row.actionState === "new_reply_needed";
}

export function InboxThreadRow(props: { row: InboxThreadDisplayRow; mailboxId: string }) {
  const { row, mailboxId } = props;
  const subject = formatInboxThreadSubject(row.subject);
  const emphasize = shouldEmphasizeInboxThreadRow(row);
  const showSenderEmail =
    row.senderEmail != null &&
    row.senderEmail.length > 0 &&
    row.senderEmail.toLowerCase() !== row.senderLabel.toLowerCase();

  return (
    <Link
      href={`/inbox/${encodeURIComponent(row.id)}?mailbox=${encodeURIComponent(mailboxId)}`}
      className={`block px-4 py-3 hover:bg-surface-muted ${FOCUS_RING} focus-visible:-outline-offset-2`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span
              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${row.unreadInbound ? "bg-info" : "bg-transparent"}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="truncate text-base font-semibold leading-6 text-foreground">
                {subject}
              </div>
              <div
                className={`truncate text-sm leading-5 ${
                  emphasize ? "font-medium text-foreground" : "font-normal text-foreground-muted"
                }`}
              >
                {showSenderEmail ? (
                  <>
                    <span>{row.senderLabel}</span>
                    <span className="text-foreground-subtle"> · </span>
                    <span className="text-foreground-subtle">{row.senderEmail}</span>
                  </>
                ) : (
                  row.senderLabel
                )}
              </div>
              {row.snippet ? (
                <div className="truncate text-xs leading-5 text-foreground-subtle">{row.snippet}</div>
              ) : null}
              {row.metaLine ? (
                <div className="truncate text-[11px] leading-4 text-foreground-subtle">{row.metaLine}</div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="shrink-0 pt-0.5 text-[11px] text-foreground-subtle">
          <span className="sm:hidden">{formatLastMessageAtMobile(row.lastMessageAt)}</span>
          <span className="hidden sm:inline">{formatLastMessageAtDesktop(row.lastMessageAt)}</span>
        </div>
      </div>
    </Link>
  );
}
