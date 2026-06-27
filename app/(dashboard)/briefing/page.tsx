import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefingRunCard } from "@/components/briefing/briefing-run-card";
import { BriefingRunNowButton } from "@/components/briefing/briefing-run-now-button";
import { InlineNotice } from "@/components/portal/ui";
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
  const briefingDisabled = !overview.settingsEnabled;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Daily Briefing</h1>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            A twice-daily summary of property-management activity.
          </p>
        </div>
        <Link
          href="/briefing/settings"
          prefetch={false}
          className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
        >
          Settings
        </Link>
      </div>

      {briefingDisabled ? (
        <InlineNotice>
          Daily Briefing is disabled for this organization. Enable it in{" "}
          <Link href="/briefing/settings" prefetch={false} className="font-medium underline-offset-2 hover:underline">
            settings
          </Link>{" "}
          to generate summaries.
        </InlineNotice>
      ) : null}

      {!overview.autoBriefingEnabled ? (
        <InlineNotice>
          Auto-briefing is off in the organization AI policy. Manual runs still work, but scheduled
          automation will not enqueue until enabled in settings.
        </InlineNotice>
      ) : null}

      {params.run === "enqueued" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Briefing run queued. Processing begins when background jobs run.
        </div>
      ) : null}

      {params.run_error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {params.run_error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {[BriefingSlot.MORNING, BriefingSlot.AFTERNOON].map((slot) => {
            const selected = slot === activeSlot;
            return (
              <Link
                key={slot}
                href={`/briefing?slot=${slot}`}
                prefetch={false}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  selected
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {BRIEFING_SLOT_LABELS[slot]}
              </Link>
            );
          })}
        </div>

        <BriefingRunNowButton slot={activeSlot} disabled={briefingDisabled} />
      </div>

      {activeRun ? (
        <BriefingRunCard run={activeRun} />
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-neutral-900">No {BRIEFING_SLOT_LABELS[activeSlot].toLowerCase()} runs yet</p>
          <p className="mt-1 text-sm text-neutral-600">
            Run a briefing manually or wait for the scheduled job once automation is enabled.
          </p>
        </div>
      )}
    </div>
  );
}
