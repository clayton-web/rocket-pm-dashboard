import {
  type OperationalWorkItem,
  type OperationalWorkItemDraft,
  type OperationsSection,
  WAITING_ON_LABELS,
} from "@/lib/operations/work-item";

/**
 * Primary section precedence (first match wins):
 * 1. overdue
 * 2. needs_attention
 * 3. waiting
 * 4. coming_up
 *
 * An item is eligible only when at least one signal is true.
 */
export const SECTION_PRECEDENCE: readonly OperationsSection[] = [
  "overdue",
  "needs_attention",
  "waiting",
  "coming_up",
] as const;

export function isWorkItemEligible(draft: OperationalWorkItemDraft): boolean {
  const { signals } = draft;
  return (
    signals.requiresStaffAction ||
    signals.isOverdue ||
    signals.isWaitingOnOther ||
    signals.isComingUp
  );
}

export function resolvePrimarySection(
  draft: OperationalWorkItemDraft,
): OperationsSection | null {
  if (!isWorkItemEligible(draft)) return null;

  const { signals } = draft;
  if (signals.isOverdue) return "overdue";
  if (signals.requiresStaffAction) return "needs_attention";
  if (signals.isWaitingOnOther) return "waiting";
  if (signals.isComingUp) return "coming_up";
  return null;
}

function buildSecondaryIndicators(
  draft: OperationalWorkItemDraft,
  primarySection: OperationsSection,
): string[] {
  const indicators = [...draft.secondaryIndicators];
  const { signals, waitingOn } = draft;

  if (
    signals.isOverdue &&
    primarySection !== "overdue" &&
    !indicators.some((i) => /overdue/i.test(i))
  ) {
    indicators.push("Overdue");
  }
  if (
    waitingOn &&
    waitingOn !== "staff" &&
    (signals.isWaitingOnOther || signals.isOverdue || signals.requiresStaffAction)
  ) {
    const label = WAITING_ON_LABELS[waitingOn];
    if (!indicators.includes(label)) {
      indicators.push(label);
    }
  }
  if (
    signals.isComingUp &&
    primarySection !== "coming_up" &&
    !indicators.some((i) => /coming up|upcoming/i.test(i))
  ) {
    indicators.push("Coming up");
  }

  return indicators;
}

/**
 * Assigns a single primary section. Returns null when the draft is not eligible.
 */
export function classifyWorkItem(draft: OperationalWorkItemDraft): OperationalWorkItem | null {
  const primarySection = resolvePrimarySection(draft);
  if (!primarySection) return null;

  const { signals, ...rest } = draft;
  return {
    ...rest,
    primarySection,
    isOverdue: signals.isOverdue,
    secondaryIndicators: buildSecondaryIndicators(draft, primarySection),
    urgency: signals.isOverdue ? "high" : rest.urgency,
  };
}

export function classifyWorkItems(
  drafts: ReadonlyArray<OperationalWorkItemDraft>,
): OperationalWorkItem[] {
  const items: OperationalWorkItem[] = [];
  for (const draft of drafts) {
    const classified = classifyWorkItem(draft);
    if (classified) items.push(classified);
  }
  return items;
}
