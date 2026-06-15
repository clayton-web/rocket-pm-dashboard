import Link from "next/link";
import type { InboxThreadActionState, InboxThreadBadge, InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";

function formatLastMessageAt(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(d);
}

function actionStateLabel(state: InboxThreadActionState) {
  if (state === "draft_review") return "Draft review";
  if (state === "new_reply_needed") return "New reply needed";
  if (state === "reply_needed") return "Reply needed";
  return null;
}

function actionStateClassName(state: InboxThreadActionState) {
  if (state === "draft_review") return "border-amber-200 bg-amber-50 text-amber-900";
  if (state === "new_reply_needed") return "border-sky-200 bg-sky-50 text-sky-900";
  if (state === "reply_needed") return "border-neutral-200 bg-neutral-50 text-neutral-700";
  return "";
}

function badgeLabel(badge: InboxThreadBadge) {
  if (badge === "classification_review") return "Review";
  if (badge === "draft_ready") return "Draft ready";
  return null;
}

function badgeClassName(badge: InboxThreadBadge) {
  if (badge === "classification_review") {
    return "border-violet-200 bg-violet-50 text-violet-900";
  }
  return "border-sky-200 bg-sky-50 text-sky-900";
}

export function InboxThreadRow(props: { row: InboxThreadDisplayRow; mailboxId: string }) {
  const { row, mailboxId } = props;
  const actionLabel = actionStateLabel(row.actionState);
  const subject = row.subject?.trim() || "(No subject)";
  const showSubjectLine = row.primaryContextLabel !== subject;

  return (
    <Link
      href={`/inbox/${encodeURIComponent(row.id)}?mailbox=${encodeURIComponent(mailboxId)}`}
      className="block px-4 py-3 hover:bg-neutral-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {row.actionState === "new_reply_needed" ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
            ) : null}
            <div
              className={`truncate text-sm ${row.actionState === "new_reply_needed" ? "font-semibold text-neutral-900" : "font-medium text-neutral-800"}`}
            >
              <span className="text-neutral-500">{row.stakeholderLabel}</span>
              <span className="text-neutral-400"> · </span>
              <span>{row.primaryContextLabel}</span>
            </div>
            {actionLabel ? (
              <span
                className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${actionStateClassName(row.actionState)}`}
              >
                {actionLabel}
              </span>
            ) : null}
            {row.badges
              .filter((badge) => badge !== "review_required")
              .map((badge) => {
                const label = badgeLabel(badge);
                if (!label) return null;
                return (
                  <span
                    key={badge}
                    className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${badgeClassName(badge)}`}
                  >
                    {label}
                  </span>
                );
              })}
          </div>
          {showSubjectLine ? (
            <div className="truncate text-xs text-neutral-600">{subject}</div>
          ) : null}
          {row.snippet ? (
            <div className="truncate text-xs text-neutral-500">{row.snippet}</div>
          ) : null}
        </div>
        <div className="shrink-0 text-[11px] text-neutral-400">{formatLastMessageAt(row.lastMessageAt)}</div>
      </div>
    </Link>
  );
}
