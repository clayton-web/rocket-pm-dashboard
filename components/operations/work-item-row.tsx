import Link from "next/link";
import type { OperationalWorkItem } from "@/lib/operations/work-item";
import { WAITING_ON_LABELS } from "@/lib/operations/work-item";

function formatDueLabel(dueAt: string | null): string | null {
  if (!dueAt) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    const d = new Date(`${dueAt}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return dueAt;
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  }
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return dueAt;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function visibleSecondaryIndicators(
  item: OperationalWorkItem,
  waitingLabel: string | null,
): string[] {
  return item.secondaryIndicators.filter((indicator) => {
    if (item.isOverdue && /^overdue$/i.test(indicator)) return false;
    if (waitingLabel && indicator === waitingLabel) return false;
    return true;
  });
}

export function WorkItemRow({ item }: { item: OperationalWorkItem }) {
  const dueLabel = formatDueLabel(item.dueAt);
  const waitingLabel =
    item.waitingOn && item.waitingOn !== "staff"
      ? WAITING_ON_LABELS[item.waitingOn]
      : null;
  const secondary = visibleSecondaryIndicators(item, waitingLabel);
  const location = [item.propertyLabel, item.unitLabel].filter(Boolean).join(" · ") || "—";

  return (
    <li className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center truncate rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
              {item.workflowBadge}
            </span>
            {item.isOverdue ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">
                <span aria-hidden="true">!</span>
                <span>Overdue</span>
              </span>
            ) : null}
            {waitingLabel ? (
              <span className="inline-flex max-w-full items-center truncate rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">
                {waitingLabel}
              </span>
            ) : null}
          </div>

          <p className="min-w-0 break-words text-base font-semibold leading-snug text-neutral-900 [overflow-wrap:anywhere]">
            {item.title}
          </p>
          {item.subtitle ? (
            <p className="break-words text-xs text-neutral-500">{item.subtitle}</p>
          ) : null}

          <p className="break-words text-sm text-neutral-700">{location}</p>

          <p className="text-sm text-neutral-600">
            <span className="text-neutral-500">Status · </span>
            {item.statusLabel}
          </p>

          <p className="text-sm text-neutral-900">
            <span className="text-neutral-500">Next · </span>
            <span className="font-semibold">{item.nextActionLabel}</span>
          </p>

          {dueLabel ? (
            <p className="text-xs text-neutral-600">
              <span className="text-neutral-500">Due / scheduled · </span>
              <time dateTime={item.dueAt ?? undefined}>{dueLabel}</time>
            </p>
          ) : null}

          {secondary.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 pt-0.5">
              {secondary.map((indicator) => (
                <li
                  key={indicator}
                  className="max-w-full truncate rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600"
                >
                  {indicator}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="shrink-0">
          <Link
            href={item.href}
            aria-label={`Open record: ${item.title}`}
            className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white no-underline hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Open record
          </Link>
        </div>
      </div>
    </li>
  );
}
