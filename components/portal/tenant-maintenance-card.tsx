import React from "react";
import { FOCUS_RING } from "@/components/portal/focus";
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
      className={`block ${SURFACE_CARD} px-4 py-4 transition-colors hover:border-foreground-subtle ${FOCUS_RING}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{request.title}</span>
        <span className="shrink-0 text-xs text-foreground-subtle">{formatPortalDateTime(request.submittedAt)}</span>
      </div>
      <p className="mt-2 text-sm text-foreground-muted">{request.statusLabel}</p>
      <p className="mt-2 text-xs text-foreground-subtle">
        <span className="capitalize">{request.urgency}</span> · {request.trade.replace(/_/g, " ")}
      </p>
      <p className="mt-2 font-mono text-[11px] text-foreground-subtle">Ref {request.id}</p>
    </Link>
  );
}

export function TenantMaintenanceDetailPanel({ request }: { request: TenantMaintenanceStatusView }) {
  return (
    <div className={`${SURFACE_CARD} px-4 py-5`}>
      <h2 className="text-base font-semibold text-foreground">{request.title}</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="text-xs text-foreground-subtle">Status</dt>
          <dd className="mt-0.5 text-foreground">{request.statusLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-subtle">Submitted</dt>
          <dd className="mt-0.5 text-foreground">{formatPortalDateTime(request.submittedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-subtle">Urgency / trade</dt>
          <dd className="mt-0.5 capitalize text-foreground">
            {request.urgency} · {request.trade.replace(/_/g, " ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-subtle">Scheduled work</dt>
          <dd className="mt-0.5 text-foreground">{formatPortalDateTime(request.scheduledWorkAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-subtle">Completed</dt>
          <dd className="mt-0.5 text-foreground">{formatPortalDateTime(request.completedAt)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-foreground-subtle">
        Reference · <span className="font-mono">{request.id}</span>
      </p>
    </div>
  );
}
