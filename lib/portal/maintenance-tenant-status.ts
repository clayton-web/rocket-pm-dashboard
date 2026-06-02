import type { MaintenanceRequestStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getPublicPortalOrgSlug } from "@/lib/portal/public-org";

export type TenantMaintenanceStatusView = {
  id: string;
  title: string;
  statusLabel: string;
  urgency: string;
  trade: string;
  submittedAt: string;
  scheduledWorkAt: string | null;
  completedAt: string | null;
};

const TENANT_STATUS_LABELS: Record<MaintenanceRequestStatus, string> = {
  new: "Received — our team will review it",
  triaged: "Under review",
  dispatched: "Assigned for service",
  in_progress: "Work in progress",
  awaiting_owner_approval: "Pending owner approval",
  scheduled: "Work scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function normalizePortalEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Loose cuid check to avoid scanning with garbage ids. */
export function isLikelyRequestId(id: string): boolean {
  const t = id.trim();
  return t.length >= 20 && t.length <= 30 && /^[a-z0-9]+$/i.test(t);
}

function toTenantView(row: {
  id: string;
  title: string;
  status: MaintenanceRequestStatus;
  urgency: string;
  trade: string;
  submittedAt: Date;
  scheduledWorkAt: Date | null;
  completedAt: Date | null;
}): TenantMaintenanceStatusView {
  return {
    id: row.id,
    title: row.title,
    statusLabel: TENANT_STATUS_LABELS[row.status] ?? row.status,
    urgency: row.urgency,
    trade: row.trade,
    submittedAt: row.submittedAt.toISOString(),
    scheduledWorkAt: row.scheduledWorkAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/**
 * Lookup by request id + email. Returns null when no match (same response either way).
 * Email must match submitted contact or any tenancy contact on the request's tenancy.
 * Scoped to public portal org only. Never returns description, triage, or staff notes.
 */
export async function lookupMaintenanceForTenant(
  requestId: string,
  email: string,
): Promise<TenantMaintenanceStatusView | null> {
  const normalizedEmail = normalizePortalEmail(email);
  if (!normalizedEmail || !isLikelyRequestId(requestId)) {
    return null;
  }

  const orgSlug = getPublicPortalOrgSlug();

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId.trim(),
      organization: { slug: orgSlug },
    },
    select: {
      id: true,
      title: true,
      status: true,
      urgency: true,
      trade: true,
      submittedAt: true,
      scheduledWorkAt: true,
      completedAt: true,
      submittedByContact: { select: { email: true } },
      tenancy: {
        select: {
          contacts: { select: { email: true } },
        },
      },
    },
  });

  if (!request) return null;

  const allowedEmails = new Set<string>();
  if (request.submittedByContact?.email) {
    allowedEmails.add(normalizePortalEmail(request.submittedByContact.email));
  }
  for (const contact of request.tenancy.contacts) {
    allowedEmails.add(normalizePortalEmail(contact.email));
  }

  if (!allowedEmails.has(normalizedEmail)) {
    return null;
  }

  return toTenantView(request);
}
