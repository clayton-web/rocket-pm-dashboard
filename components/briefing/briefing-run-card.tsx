import Link from "next/link";
import type { BriefingRunSummary } from "@/lib/briefing/briefing-queries";
import { BRIEFING_SLOT_LABELS } from "@/lib/briefing/briefing-queries";
import { BriefingStatusBadge } from "@/components/briefing/briefing-status-badge";
import { BriefingItemList } from "@/components/briefing/briefing-item-list";
import { FOCUS_RING } from "@/components/portal/focus";
import { InlineNotice, SURFACE_CARD } from "@/components/portal/ui";

function formatWindow(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${formatter.format(start)} → ${formatter.format(end)}`;
}

export function BriefingRunCard({
  run,
  compact = false,
}: {
  run: BriefingRunSummary;
  compact?: boolean;
}) {
  return (
    <section className={`${SURFACE_CARD} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {BRIEFING_SLOT_LABELS[run.slot]} briefing
            </h2>
            <BriefingStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-foreground-muted">Window: {formatWindow(run.windowStart, run.windowEnd)}</p>
        </div>
        <Link
          href={`/briefing/${run.id}`}
          prefetch={false}
          className={`rounded-sm text-sm font-medium text-foreground underline-offset-2 hover:underline ${FOCUS_RING}`}
        >
          View full run
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-foreground-subtle">Threads scanned</dt>
          <dd className="font-medium text-foreground">{run.threadsScanned}</dd>
        </div>
        <div>
          <dt className="text-foreground-subtle">Items included</dt>
          <dd className="font-medium text-foreground">{run.itemsIncluded}</dd>
        </div>
        <div>
          <dt className="text-foreground-subtle">Items skipped</dt>
          <dd className="font-medium text-foreground">{run.itemsSkipped}</dd>
        </div>
      </dl>

      {run.executiveSummary ? (
        <p className="mt-4 text-sm leading-relaxed text-foreground-muted">{run.executiveSummary}</p>
      ) : null}

      {run.errorMessage ? (
        <InlineNotice tone="danger" role="alert" className="mt-4">
          {run.errorMessage.slice(0, 280)}
          {run.errorMessage.length > 280 ? "…" : ""}
        </InlineNotice>
      ) : null}

      {!compact && run.items.length > 0 ? (
        <div className="mt-6">
          <BriefingItemList items={run.items} />
        </div>
      ) : null}
    </section>
  );
}
