import Link from "next/link";
import { FOCUS_RING } from "@/components/portal/focus";
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
            className="scroll-mt-6 text-lg font-semibold text-foreground"
          >
            {section.label}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {section.total} item{section.total === 1 ? "" : "s"}
          </p>
        </div>
        {showViewAll ? (
          <Link
            href={section.viewAllHref!}
            className={`rounded-sm text-sm font-medium text-foreground underline ${FOCUS_RING}`}
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
