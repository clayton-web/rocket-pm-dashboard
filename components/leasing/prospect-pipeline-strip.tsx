"use client";

import { Button, buttonClasses } from "@/components/portal/button";
import {
  PROSPECT_PIPELINE_STAGE_LABELS,
  PROSPECT_PIPELINE_STAGE_ORDER,
  type ProspectPipelineNextAction,
  type ProspectPipelineStage,
} from "@/lib/leasing/prospect-pipeline-stage";
import Link from "next/link";

/**
 * The stage pills are a stepper, not status chips: they show where a prospect sits in a fixed
 * sequence, so the current stage is marked by filled dark ink and the rest recede. That is position,
 * not tone, which is why this stays local rather than routing through `StatusBadge`.
 */
function stagePillClassName(isCurrent: boolean) {
  if (isCurrent) {
    return "border-primary bg-primary text-primary-foreground";
  }
  return "border-border bg-surface-muted text-foreground-muted";
}

export function ProspectPipelineStrip(props: {
  stage: ProspectPipelineStage;
  stageLabel: string;
  nextAction: ProspectPipelineNextAction;
  prospectId: string;
  primaryApplicationId: string | null;
  tenancyId: string | null;
  onScheduleViewing?: () => void;
}) {
  const visibleStages =
    props.stage === "archived"
      ? (["archived"] as const)
      : PROSPECT_PIPELINE_STAGE_ORDER;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">Pipeline</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {visibleStages.map((stage) => {
            const isCurrent = stage === props.stage;
            return (
              <span
                key={stage}
                className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${stagePillClassName(isCurrent)}`}
              >
                {PROSPECT_PIPELINE_STAGE_LABELS[stage]}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-foreground-muted">
          <span className="text-foreground-subtle">Current stage · </span>
          {props.stageLabel}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {props.nextAction === "schedule_viewing" ? (
          <Button variant="primary" size="lg" onClick={() => props.onScheduleViewing?.()}>
            Schedule Viewing
          </Button>
        ) : null}

        {props.nextAction === "mark_application_sent" ? (
          <p className="text-sm text-foreground-muted">
            Use <span className="font-medium">Send application</span> in Application handoff below.
          </p>
        ) : null}

        {props.nextAction === "view_application" && props.primaryApplicationId ? (
          <Link
            href={`/leasing/applications/${props.primaryApplicationId}`}
            className={buttonClasses({ variant: "primary" })}
          >
            View Application
          </Link>
        ) : null}

        {props.nextAction === "convert_application" && props.primaryApplicationId ? (
          <Link
            href={`/leasing/applications/${props.primaryApplicationId}`}
            className={buttonClasses({ variant: "primary" })}
          >
            Finish leasing
          </Link>
        ) : null}

        {props.nextAction === "complete_placement" && props.primaryApplicationId ? (
          <Link
            href={`/leasing/applications/${props.primaryApplicationId}`}
            className={buttonClasses({ variant: "primary" })}
          >
            Finish leasing
          </Link>
        ) : null}

        {props.nextAction === "view_tenancy" && props.tenancyId ? (
          <Link
            href={`/leasing/tenancies/${props.tenancyId}`}
            className={buttonClasses({ variant: "primary" })}
          >
            View Tenancy
          </Link>
        ) : null}
      </div>
    </div>
  );
}
