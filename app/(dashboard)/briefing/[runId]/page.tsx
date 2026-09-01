import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BriefingItemList } from "@/components/briefing/briefing-item-list";
import { BriefingMarkReviewedButton } from "@/components/briefing/briefing-mark-reviewed-button";
import { BriefingStatusBadge } from "@/components/briefing/briefing-status-badge";
import { FOCUS_RING } from "@/components/portal/focus";
import { SURFACE_PANEL } from "@/components/portal/ui";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import {
  getBriefingRunDetail,
  BRIEFING_SLOT_LABELS,
} from "@/lib/briefing/briefing-queries";

type PageProps = {
  params: Promise<{ runId: string }>;
};

function formatWindow(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${formatter.format(start)} → ${formatter.format(end)}`;
}

export default async function BriefingRunPage({ params }: PageProps) {
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    redirect("/login");
  }

  const { runId } = await params;
  const run = await getBriefingRunDetail({
    organizationId: ctx.organizationId,
    runId,
  });

  if (!run) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/briefing"
            prefetch={false}
            className={`rounded-sm text-sm font-medium text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
          >
            ← Daily Briefing
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              {BRIEFING_SLOT_LABELS[run.slot]} briefing
            </h1>
            <BriefingStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-foreground-muted">Window: {formatWindow(run.windowStart, run.windowEnd)}</p>
        </div>
        <BriefingMarkReviewedButton
          runId={run.id}
          reviewedAt={run.reviewedAt ? run.reviewedAt.toISOString() : null}
        />
      </div>

      <dl className={`grid gap-3 ${SURFACE_PANEL} p-4 text-sm sm:grid-cols-3`}>
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
        <section className={`${SURFACE_PANEL} p-5`}>
          <h2 className="text-sm font-semibold text-foreground">Executive summary</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{run.executiveSummary}</p>
        </section>
      ) : null}

      {run.errorMessage ? (
        <section
          className="rounded-xl border border-danger-border bg-danger-surface p-5 text-danger-foreground"
          role="alert"
        >
          <h2 className="text-sm font-semibold">Run error</h2>
          <p className="mt-2 text-sm">
            {run.errorMessage.slice(0, 500)}
            {run.errorMessage.length > 500 ? "…" : ""}
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Items</h2>
        <BriefingItemList items={run.items} />
      </section>
    </div>
  );
}
