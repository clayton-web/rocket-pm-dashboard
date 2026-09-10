import { SURFACE_CARD } from "@/components/portal/ui";
import { MaintenanceStatusBadge } from "./maintenance-status-badge";
import type { MaintenanceWorkflowStatus } from "./types";

export type MaintenanceDetailHeaderProps = {
  issueType: string;
  workflowStatus: MaintenanceWorkflowStatus;
  propertyName: string;
  unitLabel: string;
  tenantName: string;
  submittedAt: string;
  submittedAtIso: string;
};

export function MaintenanceDetailHeader({
  issueType,
  workflowStatus,
  propertyName,
  unitLabel,
  tenantName,
  submittedAt,
  submittedAtIso,
}: MaintenanceDetailHeaderProps) {
  return (
    <header className={`${SURFACE_CARD} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
          Maintenance request
        </p>
        <MaintenanceStatusBadge status={workflowStatus} />
      </div>
      <h1 className="mt-2 text-xl font-semibold text-foreground">{issueType}</h1>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-foreground-subtle">Property</dt>
          <dd className="mt-0.5 text-sm text-foreground">{propertyName}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-subtle">Unit</dt>
          <dd className="mt-0.5 text-sm text-foreground">{unitLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-subtle">Tenant</dt>
          <dd className="mt-0.5 text-sm text-foreground">{tenantName}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-subtle">Submitted</dt>
          <dd className="mt-0.5">
            <time dateTime={submittedAtIso} className="text-sm text-foreground">
              {submittedAt}
            </time>
          </dd>
        </div>
      </dl>
    </header>
  );
}
