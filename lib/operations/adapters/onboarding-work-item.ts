import type { OnboardingAttentionRow } from "@/lib/leasing/onboarding-attention-queue";
import type { OnboardingNextStep } from "@/lib/leasing/onboarding-progress";
import type { OperationalWorkItemDraft } from "@/lib/operations/work-item";

/**
 * Normalize an onboarding attention row using an OnboardingNextStep from
 * getOnboardingNextStep (caller must supply the helper result).
 */
export function adaptOnboardingToWorkItemDraft(
  row: OnboardingAttentionRow,
  nextStep: OnboardingNextStep,
): OperationalWorkItemDraft {
  const isOverdue = row.kind === "overdue";
  const isComingUp = row.kind === "upcoming";
  const awaitingTenant = nextStep.kind === "await_tenant_signature";

  // Upcoming move-ins stay in Coming up even when staff work remains.
  // Overdue / portal / pending (and await-tenant) use other sections.
  const requiresStaffAction =
    !isComingUp && !awaitingTenant && nextStep.kind !== "none";

  const href =
    nextStep.href ??
    (nextStep.anchorId ? `${row.href}#${nextStep.anchorId}` : row.href);

  const secondaryIndicators: string[] = [];
  if (row.kind === "portal_not_ready") {
    secondaryIndicators.push("Portal not ready");
  }
  // Do not repeat next-action title as a secondary chip — it already appears in Next ·

  return {
    key: `onboarding:${row.tenancy.id}`,
    recordType: "tenancy",
    recordId: row.tenancy.id,
    title: row.tenantLabel ?? "Tenant",
    subtitle: null,
    propertyLabel: row.propertyName,
    unitLabel: row.unitLabel,
    statusLabel: row.badgeLabel,
    nextActionLabel: nextStep.title,
    href,
    viewAllHref: `/leasing/onboarding?queue=${row.kind}`,
    workflowBadge: "Onboarding",
    dueAt: row.moveInDate,
    waitingOn: awaitingTenant ? "tenant" : "staff",
    assignedToLabel: null,
    urgency: isOverdue ? "high" : "normal",
    secondaryIndicators,
    signals: {
      requiresStaffAction,
      isOverdue,
      isWaitingOnOther: awaitingTenant,
      isComingUp: isComingUp && !isOverdue,
    },
  };
}
