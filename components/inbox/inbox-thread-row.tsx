import Link from "next/link";
import { EMAIL_THREAD_CATEGORY_LABELS } from "@/lib/inbox/email-thread-category";
import type { InboxThreadBadge, InboxThreadDisplayRow } from "@/lib/inbox/inbox-thread-display";

function formatLastMessageAt(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(d);
}

function badgeLabel(badge: InboxThreadBadge) {
  if (badge === "review_required") return "Review required";
  if (badge === "classification_review") return "Review";
  return "Draft ready";
}

function badgeClassName(badge: InboxThreadBadge) {
  if (badge === "review_required") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (badge === "classification_review") {
    return "border-violet-200 bg-violet-50 text-violet-900";
  }
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function chipClassName(kind: InboxThreadDisplayRow["chips"][number]["kind"]) {
  if (kind === "property") return "border-violet-200 bg-violet-50 text-violet-900";
  if (kind === "tenancy") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-orange-200 bg-orange-50 text-orange-900";
}

export function InboxThreadRow(props: { row: InboxThreadDisplayRow; mailboxId: string }) {
  const { row, mailboxId } = props;
  const visibleChips = row.chips.slice(0, 3);
  const hiddenChipCount = row.chips.length - visibleChips.length;

  return (
    <Link
      href={`/inbox/${encodeURIComponent(row.id)}?mailbox=${encodeURIComponent(mailboxId)}`}
      className="block px-4 py-3 hover:bg-neutral-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`truncate text-sm ${row.isUnread ? "font-semibold text-neutral-900" : "font-medium text-neutral-800"}`}
            >
              {row.subject?.trim() || "(No subject)"}
            </div>
            {row.badges.map((badge) => (
              <span
                key={badge}
                className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${badgeClassName(badge)}`}
              >
                {badgeLabel(badge)}
              </span>
            ))}
            {row.categories.map((category) => (
              <span
                key={category}
                className="inline-flex shrink-0 items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600"
              >
                {EMAIL_THREAD_CATEGORY_LABELS[category]}
              </span>
            ))}
          </div>
          <div className="truncate text-xs text-neutral-500">{row.snippet}</div>
          {row.participantEmails.length ? (
            <div className="mt-1 truncate text-[11px] text-neutral-400">
              {row.participantEmails.slice(0, 4).join(", ")}
              {row.participantEmails.length > 4 ? "…" : ""}
            </div>
          ) : null}
          {visibleChips.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleChips.map((chip) => (
                <span
                  key={`${chip.kind}-${chip.label}`}
                  className={`inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-[10px] font-medium ${chipClassName(chip.kind)}`}
                >
                  {chip.label}
                </span>
              ))}
              {hiddenChipCount > 0 ? (
                <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                  +{hiddenChipCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-[11px] text-neutral-400">{formatLastMessageAt(row.lastMessageAt)}</div>
      </div>
    </Link>
  );
}
