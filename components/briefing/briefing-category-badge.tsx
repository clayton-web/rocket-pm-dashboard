import type { BriefingItemCategory } from "@prisma/client";
import { StatusBadge } from "@/components/portal/status-badge";
import { BRIEFING_CATEGORY_LABELS } from "@/lib/briefing/briefing-queries";

export function BriefingCategoryBadge({ category }: { category: BriefingItemCategory }) {
  return <StatusBadge tone="neutral">{BRIEFING_CATEGORY_LABELS[category]}</StatusBadge>;
}
