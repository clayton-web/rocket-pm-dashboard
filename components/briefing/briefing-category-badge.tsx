import type { BriefingItemCategory } from "@prisma/client";
import { BRIEFING_CATEGORY_LABELS } from "@/lib/briefing/briefing-queries";

export function BriefingCategoryBadge({ category }: { category: BriefingItemCategory }) {
  return (
    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
      {BRIEFING_CATEGORY_LABELS[category]}
    </span>
  );
}
