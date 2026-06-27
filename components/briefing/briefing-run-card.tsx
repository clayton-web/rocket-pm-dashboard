import Link from "next/link";
import type { BriefingRunSummary } from "@/lib/briefing/briefing-queries";
import { BRIEFING_SLOT_LABELS } from "@/lib/briefing/briefing-queries";
import { BriefingStatusBadge } from "@/components/briefing/briefing-status-badge";
import { BriefingItemList } from "@/components/briefing/briefing-item-list";

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
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-900">
              {BRIEFING_SLOT_LABELS[run.slot]} briefing
            </h2>
            <BriefingStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-neutral-600">Window: {formatWindow(run.windowStart, run.windowEnd)}</p>
        </div>
        <Link
          href={`/briefing/${run.id}`}
          prefetch={false}
          className="text-sm font-medium text-neutral-900 underline-offset-2 hover:underline"
        >
          View full run
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-neutral-500">Threads scanned</dt>
          <dd className="font-medium text-neutral-900">{run.threadsScanned}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Items included</dt>
          <dd className="font-medium text-neutral-900">{run.itemsIncluded}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Items skipped</dt>
          <dd className="font-medium text-neutral-900">{run.itemsSkipped}</dd>
        </div>
      </dl>

      {run.executiveSummary ? (
        <p className="mt-4 text-sm leading-relaxed text-neutral-700">{run.executiveSummary}</p>
      ) : null}

      {run.errorMessage ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {run.errorMessage.slice(0, 280)}
          {run.errorMessage.length > 280 ? "…" : ""}
        </p>
      ) : null}

      {!compact && run.items.length > 0 ? (
        <div className="mt-6">
          <BriefingItemList items={run.items} />
        </div>
      ) : null}
    </section>
  );
}
