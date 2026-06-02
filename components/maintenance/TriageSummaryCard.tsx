import { SURFACE_PANEL } from "@/components/portal/ui";
import { formatGuidedMetaForDisplay } from "@/lib/maintenance/split-triage";
import type { MaintenanceTriageSummary } from "./types";

const urgencyLabel = {
  emergency: "Emergency",
  urgent: "Urgent",
  routine: "Routine",
} as const;

export function TriageSummaryCard({ triage }: { triage: MaintenanceTriageSummary }) {
  const summaryMain =
    triage.summary.trim() || (triage.technicalAppendix ? "See guided flow details below." : "—");
  const formattedAppendix = triage.technicalAppendix
    ? formatGuidedMetaForDisplay(triage.technicalAppendix)
    : "";

  return (
    <section className={`${SURFACE_PANEL} p-4`} aria-labelledby="triage-heading">
      <h2 id="triage-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Triage summary
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-neutral-900">Urgency</dt>
          <dd className="mt-1 text-sm text-neutral-700">{urgencyLabel[triage.urgency]}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-neutral-900">Suggested trade</dt>
          <dd className="mt-1 text-sm text-neutral-700">{triage.suggestedTrade}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-semibold text-neutral-900">Summary</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{summaryMain}</dd>
          {formattedAppendix ? (
            <details className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50/90">
              <summary className="cursor-pointer px-3 py-2 text-xs text-neutral-500">
                Guided flow details
              </summary>
              <pre className="max-h-52 overflow-auto border-t px-3 py-2 font-mono text-xs text-neutral-700">
                {formattedAppendix}
              </pre>
            </details>
          ) : null}
        </div>
      </dl>
    </section>
  );
}
