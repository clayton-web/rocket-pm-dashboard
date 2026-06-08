"use client";

import { markProspectQualifiedAction } from "@/app/(dashboard)/leasing/prospects/[prospectId]/actions";
import { PrimaryButton } from "@/components/portal/ui";
import {
  PROSPECT_PIPELINE_STAGE_LABELS,
  PROSPECT_PIPELINE_STAGE_ORDER,
  type ProspectPipelineNextAction,
  type ProspectPipelineStage,
} from "@/lib/leasing/prospect-pipeline-stage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function stagePillClassName(isCurrent: boolean) {
  if (isCurrent) {
    return "border-neutral-900 bg-neutral-900 text-white";
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

export function ProspectPipelineStrip(props: {
  stage: ProspectPipelineStage;
  stageLabel: string;
  nextAction: ProspectPipelineNextAction;
  prospectId: string;
  primaryApplicationId: string | null;
  tenancyId: string | null;
  canMarkQualified: boolean;
  onScheduleViewing?: () => void;
}) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [qualifyPending, startQualifyTransition] = useTransition();

  function onMarkQualified() {
    setActionError(null);
    startQualifyTransition(async () => {
      const result = await markProspectQualifiedAction(props.prospectId);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const visibleStages =
    props.stage === "archived"
      ? (["archived"] as const)
      : PROSPECT_PIPELINE_STAGE_ORDER;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Pipeline</p>
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
        <p className="mt-2 text-sm text-neutral-700">
          <span className="text-neutral-500">Current stage · </span>
          {props.stageLabel}
        </p>
      </div>

      {actionError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {props.nextAction === "mark_qualified" && props.canMarkQualified ? (
          <PrimaryButton
            type="button"
            className="!w-auto px-6"
            disabled={qualifyPending}
            onClick={onMarkQualified}
          >
            {qualifyPending ? "Saving…" : "Mark Qualified"}
          </PrimaryButton>
        ) : null}

        {props.nextAction === "schedule_viewing" ? (
          <PrimaryButton
            type="button"
            className="!w-auto px-6"
            onClick={() => props.onScheduleViewing?.()}
          >
            Schedule Viewing
          </PrimaryButton>
        ) : null}

        {props.nextAction === "mark_application_sent" ? (
          <p className="text-sm text-neutral-600">
            Copy the application link in Application handoff below, then mark application sent.
          </p>
        ) : null}

        {props.nextAction === "view_application" && props.primaryApplicationId ? (
          <Link
            href={`/leasing/applications/${props.primaryApplicationId}`}
            className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-neutral-800"
          >
            View Application
          </Link>
        ) : null}

        {props.nextAction === "convert_application" && props.primaryApplicationId ? (
          <Link
            href={`/leasing/applications/${props.primaryApplicationId}`}
            className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-neutral-800"
          >
            Convert Approved Application
          </Link>
        ) : null}

        {props.nextAction === "view_tenancy" && props.tenancyId ? (
          <Link
            href={`/leasing/tenancies/${props.tenancyId}`}
            className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-neutral-800"
          >
            View Tenancy
          </Link>
        ) : null}
      </div>
    </div>
  );
}
