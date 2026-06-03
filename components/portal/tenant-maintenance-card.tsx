import Link from "next/link";
import { formatPortalDateTime } from "@/lib/portal/format-dates";
import type { TenantMaintenanceStatusView } from "@/lib/portal/maintenance-tenant-status";
import { SURFACE_CARD } from "@/components/portal/ui";

export function TenantMaintenanceCard({
  request,
  detailHref,
}: {
  request: TenantMaintenanceStatusView;
  detailHref: string;
}) {
  return (
    <Link
      href={detailHref}
      className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-neutral-400`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-900">{request.title}</span>
        <span className="shrink-0 text-xs text-neutral-500">{formatPortalDateTime(request.submittedAt)}</span>
      </div>
      <p className="mt-2 text-sm text-neutral-600">{request.statusLabel}</p>
      <p className="mt-2 text-xs text-neutral-500">
        <span className="capitalize">{request.urgency}</span> · {request.trade.replace(/_/g, " ")}
      </p>
      <p className="mt-2 font-mono text-[11px] text-neutral-400">Ref {request.id}</p>
    </Link>
  );
}

export function TenantMaintenanceDetailPanel({ request }: { request: TenantMaintenanceStatusView }) {
  return (
    <div className={`${SURFACE_CARD} px-4 py-5`}>
      <h2 className="text-base font-semibold text-neutral-900">{request.title}</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Status</dt>
          <dd className="mt-0.5 text-neutral-800">{request.statusLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Submitted</dt>
          <dd className="mt-0.5 text-neutral-800">{formatPortalDateTime(request.submittedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Urgency / trade</dt>
          <dd className="mt-0.5 capitalize text-neutral-800">
            {request.urgency} · {request.trade.replace(/_/g, " ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Scheduled work</dt>
          <dd className="mt-0.5 text-neutral-800">{formatPortalDateTime(request.scheduledWorkAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Completed</dt>
          <dd className="mt-0.5 text-neutral-800">{formatPortalDateTime(request.completedAt)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-neutral-500">
        Reference · <span className="font-mono">{request.id}</span>
      </p>
    </div>
  );
}
