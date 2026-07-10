import Link from "next/link";
import { InlineNotice } from "@/components/portal/ui";
import { WorkItemRow } from "@/components/operations/work-item-row";
import type { OperationsCentreSection } from "@/lib/operations/operations-centre.service";

export function AttentionSection({
  section,
  previewLimit,
}: {
  section: OperationsCentreSection;
  previewLimit: number;
}) {
  const showViewAll = section.total > previewLimit && section.viewAllHref;

  return (
    <section aria-labelledby={`ops-section-${section.id}`} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`ops-section-${section.id}`}
            className="scroll-mt-6 text-lg font-semibold text-neutral-900"
          >
            {section.label}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {section.total} item{section.total === 1 ? "" : "s"}
          </p>
        </div>
        {showViewAll ? (
          <Link
            href={section.viewAllHref!}
            className="text-sm font-medium text-neutral-900 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            View all in queue →
          </Link>
        ) : null}
      </div>

      {section.total === 0 ? (
        <InlineNotice className="py-2">Nothing in {section.label.toLowerCase()}.</InlineNotice>
      ) : (
        <ul className="space-y-2">
          {section.preview.map((item) => (
            <WorkItemRow key={item.key} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function SummaryPill({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 transition-colors hover:border-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
    >
      <span className="font-semibold tabular-nums text-neutral-900">{count}</span>
      <span>{label}</span>
    </a>
  );
}
