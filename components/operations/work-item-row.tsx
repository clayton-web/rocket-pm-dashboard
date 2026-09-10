import Link from "next/link";
import { buttonClasses } from "@/components/portal/button";
import { StatusBadge } from "@/components/portal/status-badge";
import { SURFACE_CARD } from "@/components/portal/ui";
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
  urgencyLabel: string | null,
): string[] {
  return item.secondaryIndicators.filter((indicator) => {
    if (item.isOverdue && /^overdue$/i.test(indicator)) return false;
    if (waitingLabel && indicator === waitingLabel) return false;
    if (urgencyLabel && indicator === urgencyLabel) return false;
    if (/^unassigned$/i.test(indicator)) return false;
    return true;
  });
}

function urgencyBadgeLabel(item: OperationalWorkItem): string | null {
  if (item.secondaryIndicators.includes("Emergency")) return "Emergency";
  if (item.secondaryIndicators.includes("Urgent")) return "Urgent";
  return null;
}

export function WorkItemRow({ item }: { item: OperationalWorkItem }) {
  const dueLabel = formatDueLabel(item.dueAt);
  const waitingLabel =
    item.waitingOn && item.waitingOn !== "staff"
      ? WAITING_ON_LABELS[item.waitingOn]
      : null;
  const urgencyLabel = urgencyBadgeLabel(item);
  const showUnassigned = item.secondaryIndicators.some((i) => /^unassigned$/i.test(i));
  const secondary = visibleSecondaryIndicators(item, waitingLabel, urgencyLabel);
  const location = [item.propertyLabel, item.unitLabel].filter(Boolean).join(" · ") || "—";

  return (
    <li className={`${SURFACE_CARD} px-4 py-3`}>
      {/*
        Stack action below content on narrow viewports so long Inbox subjects/senders
        and the Open record control do not compete for one horizontal row.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral">{item.workflowBadge}</StatusBadge>
            {item.isOverdue ? (
              <StatusBadge tone="warning" emphasis="strong" icon="!">
                Overdue
              </StatusBadge>
            ) : null}
            {urgencyLabel ? (
              <StatusBadge
                tone={urgencyLabel === "Emergency" ? "danger" : "warning"}
                emphasis="strong"
              >
                {urgencyLabel}
              </StatusBadge>
            ) : null}
            {waitingLabel ? <StatusBadge tone="info">{waitingLabel}</StatusBadge> : null}
            {showUnassigned ? (
              <StatusBadge tone="neutral" emphasis="strong">
                Unassigned
              </StatusBadge>
            ) : null}
          </div>

          <p className="min-w-0 break-words text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
            {item.title}
          </p>
          {item.subtitle ? (
            <p className="break-words text-xs text-foreground-subtle [overflow-wrap:anywhere]">
              {item.subtitle}
            </p>
          ) : null}

          <p className="break-words text-sm text-foreground [overflow-wrap:anywhere]">{location}</p>

          <p className="break-words text-sm text-foreground-muted [overflow-wrap:anywhere]">
            <span className="text-foreground-subtle">Status · </span>
            {item.statusLabel}
          </p>

          <p className="break-words text-sm text-foreground [overflow-wrap:anywhere]">
            <span className="text-foreground-subtle">Next · </span>
            <span className="font-semibold">{item.nextActionLabel}</span>
          </p>

          {item.assignedToLabel ? (
            <p className="break-words text-xs text-foreground-muted [overflow-wrap:anywhere]">
              <span className="text-foreground-subtle">Assignee · </span>
              {item.assignedToLabel}
            </p>
          ) : null}

          {dueLabel ? (
            <p className="text-xs text-foreground-muted">
              <span className="text-foreground-subtle">Due / scheduled · </span>
              <time dateTime={item.dueAt ?? undefined}>{dueLabel}</time>
            </p>
          ) : null}

          {secondary.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Additional indicators">
              {secondary.map((indicator) => (
                <li
                  key={indicator}
                  className="max-w-full truncate rounded border border-border px-1.5 py-0.5 text-[11px] text-foreground-muted"
                >
                  {indicator}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="shrink-0 self-start">
          <Link
            href={item.href}
            aria-label={`Open record: ${item.title}`}
            className={buttonClasses({ variant: "primary", size: "xs", className: "max-w-full" })}
          >
            Open record
          </Link>
        </div>
      </div>
    </li>
  );
}

