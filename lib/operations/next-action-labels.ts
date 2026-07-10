import type { ProspectPipelineNextAction } from "@/lib/leasing/prospect-pipeline-stage";
import type { ApplicationConversionPolicy } from "@/lib/leasing/application-conversion-policy";

/**
 * Display labels for prospect pipeline next actions.
 * Matches staff-facing copy in prospect-pipeline-strip (Schedule Viewing, Send application, etc.).
 * Source of truth for *which* action remains deriveProspectPipelineNextAction.
 */
export function labelForProspectPipelineNextAction(
  action: ProspectPipelineNextAction,
): string {
  switch (action) {
    case "schedule_viewing":
      return "Schedule Viewing";
    case "mark_application_sent":
      return "Send application";
    case "view_application":
      return "View Application";
    case "convert_application":
    case "complete_placement":
      return "Finish leasing";
    case "view_tenancy":
      return "View Tenancy";
    case "mark_qualified":
      return "Mark qualified";
    case "none":
      return "No action required";
  }
}

/**
 * Review-queue applications do not have a dedicated next-action helper;
 * staff primary action on the queue/detail is review.
 */
export function labelForApplicationReview(): string {
  return "Review application";
}

/**
 * Conversion / placement labels from getApplicationConversionPolicy.
 * Prefer recommendedAction mapping aligned with application detail CTAs.
 */
export function labelForApplicationConversionPolicy(
  policy: ApplicationConversionPolicy,
): string {
  if (policy.recommendedAction === "await_placement_completion") {
    return "Finish leasing";
  }
  if (policy.recommendedAction === "convert_managed_tenancy") {
    return "Finish leasing";
  }
  return policy.staffStateLabel;
}
