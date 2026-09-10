import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefingRunCard } from "@/components/briefing/briefing-run-card";
import { FOCUS_RING } from "@/components/portal/focus";
import { InlineNotice, SURFACE_DASHED } from "@/components/portal/ui";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getBriefingOverview, BRIEFING_SLOT_LABELS } from "@/lib/briefing/briefing-queries";
import { BriefingSlot } from "@prisma/client";

type PageProps = {
  searchParams: Promise<{
    slot?: string;
    run?: string;
    run_error?: string;
  }>;
};

function parseSlotParam(value: string | undefined): BriefingSlot {
  if (value === BriefingSlot.AFTERNOON) return BriefingSlot.AFTERNOON;
  return BriefingSlot.MORNING;
}

export default async function BriefingPage({ searchParams }: PageProps) {
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    redirect("/login");
  }

  const params = await searchParams;
  const activeSlot = parseSlotParam(params.slot);
  const overview = await getBriefingOverview(ctx.organizationId);
  const activeRun = overview.latestBySlot[activeSlot] ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Daily Briefing</h1>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
            Historical summaries of property-management activity.
          </p>
        </div>
        <Link
          href="/briefing/settings"
          prefetch={false}
          className={`rounded-sm text-sm font-medium text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
        >
          Settings
        </Link>
      </div>

      <InlineNotice>
        Daily Briefing is decommissioned. New briefings cannot be generated. Historical runs remain
        available below.
      </InlineNotice>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-surface-muted p-1">
          {[BriefingSlot.MORNING, BriefingSlot.AFTERNOON].map((slot) => {
            const selected = slot === activeSlot;
            return (
              <Link
                key={slot}
                href={`/briefing?slot=${slot}`}
                prefetch={false}
                aria-current={selected ? "true" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${FOCUS_RING} ${
                  selected
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {BRIEFING_SLOT_LABELS[slot]}
              </Link>
            );
          })}
        </div>
      </div>

      {activeRun ? (
        <BriefingRunCard run={activeRun} />
      ) : (
        <div className={`${SURFACE_DASHED} px-6 py-10 text-center`}>
          <p className="text-sm font-medium text-foreground">
            No {BRIEFING_SLOT_LABELS[activeSlot].toLowerCase()} runs yet
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            Daily Briefing is decommissioned, so no new summaries will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
