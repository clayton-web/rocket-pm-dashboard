import Link from "next/link";
import React from "react";
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
      className="block px-4 py-3 hover:bg-neutral-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span
              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${row.unreadInbound ? "bg-sky-500" : "bg-transparent"}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div
                className={`truncate text-base leading-6 ${
                  emphasize ? "font-semibold text-neutral-900" : "font-semibold text-neutral-900"
                }`}
              >
                {subject}
              </div>
              <div
                className={`truncate text-sm leading-5 ${
                  emphasize ? "font-medium text-neutral-800" : "font-normal text-neutral-600"
                }`}
              >
                {showSenderEmail ? (
                  <>
                    <span>{row.senderLabel}</span>
                    <span className="text-neutral-400"> · </span>
                    <span className="text-neutral-500">{row.senderEmail}</span>
                  </>
                ) : (
                  row.senderLabel
                )}
              </div>
              {row.snippet ? (
                <div className="truncate text-xs leading-5 text-neutral-500">{row.snippet}</div>
              ) : null}
              {row.metaLine ? (
                <div className="truncate text-[11px] leading-4 text-neutral-500">{row.metaLine}</div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="shrink-0 pt-0.5 text-[11px] text-neutral-400">
          <span className="sm:hidden">{formatLastMessageAtMobile(row.lastMessageAt)}</span>
          <span className="hidden sm:inline">{formatLastMessageAtDesktop(row.lastMessageAt)}</span>
        </div>
      </div>
    </Link>
  );
}
