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
};

export type DerivedProspectPipeline = {
  stage: ProspectPipelineStage;
  stageLabel: string;
  primaryApplicationId: string | null;
  tenancyId: string | null;
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
 * 3. approved — primary application approved (no tenancy yet)
 * 4. declined — primary application declined or withdrawn
 * 5. application_received — primary application submitted or under review
 * 6. application_sent — applicationSentAt set and application not yet received
 * 7. viewing_booked — any showing with status scheduled
 * 8. qualified — qualifiedAt set
 * 9. viewing_request — default intake
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
    };
  }

  const primary = pickPrimaryApplication(args.applications);
  const primaryApplicationId = primary?.id ?? null;
  const tenancyId = primary?.tenancyId ?? null;

  if (primary?.hasTenancy && tenancyId) {
    return {
      stage: "tenant",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.tenant,
      primaryApplicationId,
      tenancyId,
    };
  }

  if (primary?.status === "approved") {
    return {
      stage: "approved",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.approved,
      primaryApplicationId,
      tenancyId: null,
    };
  }

  if (primary?.status === "declined" || primary?.status === "withdrawn") {
    return {
      stage: "declined",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.declined,
      primaryApplicationId,
      tenancyId: null,
    };
  }

  if (primary && isApplicationReceived(primary.status)) {
    return {
      stage: "application_received",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.application_received,
      primaryApplicationId,
      tenancyId: null,
    };
  }

  if (args.prospect.applicationSentAt != null) {
    return {
      stage: "application_sent",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.application_sent,
      primaryApplicationId,
      tenancyId: null,
    };
  }

  if (hasScheduledShowing(args.showings)) {
    return {
      stage: "viewing_booked",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.viewing_booked,
      primaryApplicationId,
      tenancyId: null,
    };
  }

  if (args.prospect.qualifiedAt != null) {
    return {
      stage: "qualified",
      stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.qualified,
      primaryApplicationId,
      tenancyId: null,
    };
  }

  return {
    stage: "viewing_request",
    stageLabel: PROSPECT_PIPELINE_STAGE_LABELS.viewing_request,
    primaryApplicationId,
    tenancyId: null,
  };
}

export type ProspectPipelineNextAction =
  | "mark_qualified"
  | "schedule_viewing"
  | "mark_application_sent"
  | "view_application"
  | "convert_application"
  | "view_tenancy"
  | "none";

export function deriveProspectPipelineNextAction(
  pipeline: DerivedProspectPipeline,
  prospect: ProspectPipelineProspect,
): ProspectPipelineNextAction {
  if (prospect.status === "archived") return "none";

  switch (pipeline.stage) {
    case "viewing_request":
      return "mark_qualified";
    case "qualified":
      return "schedule_viewing";
    case "viewing_booked":
      return "mark_application_sent";
    case "application_sent":
      return pipeline.primaryApplicationId ? "view_application" : "none";
    case "application_received":
      return pipeline.primaryApplicationId ? "view_application" : "none";
    case "approved":
      return pipeline.primaryApplicationId ? "convert_application" : "none";
    case "tenant":
      return pipeline.tenancyId ? "view_tenancy" : "none";
    case "declined":
      return pipeline.primaryApplicationId ? "view_application" : "none";
    case "archived":
      return "none";
  }
}
