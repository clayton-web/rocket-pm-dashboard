import { SURFACE_CARD } from "@/components/portal/ui";
import type { MaintenanceWorkflowStatus } from "./types";

const statusBadgeClass: Record<MaintenanceWorkflowStatus, string> = {
  new: "border border-neutral-300 bg-white text-neutral-800",
  dispatched: "bg-neutral-100 text-neutral-800",
  completed: "bg-neutral-900 text-white",
  cancelled: "text-neutral-500",
};

const statusLabel: Record<MaintenanceWorkflowStatus, string> = {
  new: "New",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
};

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
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Maintenance request</p>
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass[workflowStatus]}`}
        >
          {statusLabel[workflowStatus]}
        </span>
      </div>
      <h1 className="mt-2 text-xl font-semibold text-neutral-900">{issueType}</h1>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">Property</dt>
          <dd className="mt-0.5 text-sm text-neutral-800">{propertyName}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Unit</dt>
          <dd className="mt-0.5 text-sm text-neutral-800">{unitLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Tenant</dt>
          <dd className="mt-0.5 text-sm text-neutral-800">{tenantName}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Submitted</dt>
          <dd className="mt-0.5">
            <time dateTime={submittedAtIso} className="text-sm text-neutral-800">
              {submittedAt}
            </time>
          </dd>
        </div>
      </dl>
    </header>
  );
}
