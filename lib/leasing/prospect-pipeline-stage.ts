import type { ApplicationStatus, ProspectStatus, ShowingStatus } from "@prisma/client";

export const PROSPECT_PIPELINE_STAGE_ORDER = [
  "viewing_request",
  "qualified",
  "viewing_booked",
  "application_sent",
  "application_received",
  "approved",
  "declined",
  "tenant",
  "placed",
] as const;

export type ProspectPipelineStage =
  | (typeof PROSPECT_PIPELINE_STAGE_ORDER)[number]
  | "archived";

export type ProspectPipelineProspect = {
  status: ProspectStatus | string;
  qualifiedAt: Date | string | null;
  applicationSentAt: Date | string | null;
};

export type ProspectPipelineShowing = {
  status: ShowingStatus | string;
};

export type ProspectPipelineApplication = {
  status: ApplicationStatus | string;
  submittedAt?: Date | string | null;
  hasTenancy?: boolean;
  hasPlacement?: boolean;
  placementId?: string | null;
};

export type DerivedProspectPipeline = {
  stage: ProspectPipelineStage;
  stageLabel: string;
  primaryApplicationId: string | null;
  tenancyId: string | null;
  placementId: string | null;
};

export const PROSPECT_PIPELINE_STAGE_LABELS: Record<ProspectPipelineStage, string> = {
  viewing_request: "Viewing Request",
  qualified: "Qualified",
  viewing_booked: "Viewing Booked",
  application_sent: "Application Sent",
  application_received: "Application Received",
  approved: "Approved",
  declined: "Declined",
  tenant: "Tenant",
  placed: "Placement completed",
  archived: "Archived",
};

const APPLICATION_RANK: Record<string, number> = {
  draft: 0,
  submitted: 1,
  under_review: 2,
  approved: 3,
  declined: 3,
  withdrawn: 3,
};

function pickPrimaryApplication(
  applications: ReadonlyArray<
    ProspectPipelineApplication & { id?: string; tenancyId?: string | null }
  >,
): (ProspectPipelineApplication & { id?: string; tenancyId?: string | null }) | null {
  if (applications.length === 0) return null;

  return [...applications].sort((a, b) => {
    if (a.hasTenancy && !b.hasTenancy) return -1;
    if (!a.hasTenancy && b.hasTenancy) return 1;
    if (a.hasPlacement && !b.hasPlacement) return -1;
    if (!a.hasPlacement && b.hasPlacement) return 1;
    const rankDiff = (APPLICATION_RANK[b.status] ?? 0) - (APPLICATION_RANK[a.status] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    const aSubmitted = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bSubmitted = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bSubmitted - aSubmitted;
  })[0] ?? null;
}

function hasScheduledShowing(showings: ReadonlyArray<ProspectPipelineShowing>): boolean {
  return showings.some((showing) => showing.status === "scheduled");
}

function isApplicationReceived(status: string): boolean {
  return status === "submitted" || status === "under_review";
}

/**
 * Derive the current leasing pipeline stage for a prospect.
 *
 * Precedence (most advanced wins):
 * 1. archived — prospect.status is archived
 * 2. tenant — primary linked application has a tenancy
 * 3. placed — primary linked application has a TenantPlacement
 * 4. approved — primary application approved (no outcome yet)
 * 5. declined — primary application declined or withdrawn
 * 6. application_received — primary application submitted or under review
 * 7. application_sent — applicationSentAt set and application not yet received
 * 8. viewing_booked — any showing with status scheduled
 * 9. qualified — qualifiedAt set
 * 10. viewing_request — default intake
 */
export function deriveProspectPipelineStage(args: {
  prospect: ProspectPipelineProspect;
  showings: ReadonlyArray<ProspectPipelineShowing>;
  applications: ReadonlyArray<
    ProspectPipelineApplication & { id?: string; tenancyId?: string | null }
  >;
}): DerivedProspectPipeline {
  if (args.prospect.status === "archived") {
    return {
      stage: "archived",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.archived,
      primaryApplicationId: null,
      tenancyId: null,
      placementId: null,
    };
  }

  const primary = pickPrimaryApplication(args.applications);
  const primaryApplicationId = primary?.id ?? null;
  const tenancyId = primary?.tenancyId ?? null;
  const placementId = primary?.placementId ?? null;

  if (primary?.hasTenancy && tenancyId) {
    return {
      stage: "tenant",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.tenant,
      primaryApplicationId,
      tenancyId,
      placementId: null,
    };
  }

  if (primary?.hasPlacement && placementId) {
    return {
      stage: "placed",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.placed,
      primaryApplicationId,
      tenancyId: null,
      placementId,
    };
  }

  if (primary?.status === "approved") {
    return {
      stage: "approved",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.approved,
      primaryApplicationId,
      tenancyId: null,
      placementId: null,
    };
  }

  if (primary?.status === "declined" || primary?.status === "withdrawn") {
    return {
      stage: "declined",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.declined,
      primaryApplicationId,
      tenancyId: null,
      placementId: null,
    };
  }

  if (primary && isApplicationReceived(primary.status)) {
    return {
      stage: "application_received",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.application_received,
      primaryApplicationId,
      tenancyId: null,
      placementId: null,
    };
  }

  if (args.prospect.applicationSentAt != null) {
    return {
      stage: "application_sent",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.application_sent,
      primaryApplicationId,
      tenancyId: null,
      placementId: null,
    };
  }

  if (hasScheduledShowing(args.showings)) {
    return {
      stage: "viewing_booked",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.viewing_booked,
      primaryApplicationId,
      tenancyId: null,
      placementId: null,
    };
  }

  if (args.prospect.qualifiedAt != null) {
    return {
      stage: "qualified",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.qualified,
      primaryApplicationId,
      tenancyId: null,
      placementId: null,
    };
  }

  return {
    stage: "viewing_request",
    stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.viewing_request,
    primaryApplicationId,
    tenancyId: null,
    placementId: null,
  };
}

export type ProspectPipelineNextAction =
  | "mark_qualified"
  | "schedule_viewing"
  | "mark_application_sent"
  | "view_application"
  | "convert_application"
  | "complete_placement"
  | "view_tenancy"
  | "none";

export type ProspectPipelineNextActionContext = {
  /** When true, approved applications need TenantPlacement completion, not managed conversion. */
  placementOnly?: boolean;
};

export function deriveProspectPipelineNextAction(
  pipeline: DerivedProspectPipeline,
  prospect: ProspectPipelineProspect,
  context?: ProspectPipelineNextActionContext,
): ProspectPipelineNextAction {
  if (prospect.status === "archived") return "none";

  switch (pipeline.stage) {
    case "viewing_request":
    case "qualified":
      // Qualification is automatic when a showing is scheduled; do not require Mark Qualified.
      return "schedule_viewing";
    case "viewing_booked":
      return "mark_application_sent";
    case "application_sent":
      return pipeline.primaryApplicationId ? "view_application" : "none";
    case "application_received":
      return pipeline.primaryApplicationId ? "view_application" : "none";
    case "approved":
      if (!pipeline.primaryApplicationId) return "none";
      return context?.placementOnly ? "complete_placement" : "convert_application";
    case "tenant":
      return pipeline.tenancyId ? "view_tenancy" : "none";
    case "placed":
      return pipeline.primaryApplicationId ? "view_application" : "none";
    case "declined":
      return pipeline.primaryApplicationId ? "view_application" : "none";
    case "archived":
      return "none";
  }
}

/** Prospects whose leasing journey is complete enough to leave the attention queue. */
export function isProspectAttentionComplete(stage: ProspectPipelineStage): boolean {
  return stage === "tenant" || stage === "placed" || stage === "archived" || stage === "declined";
}
