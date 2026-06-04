import prisma from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/services/errors";
import { listPropertiesForUser, listTenanciesForProperty } from "@/lib/services";
import type { StaffContext } from "@/lib/services/staff-context";
import {
  classifyOnboardingAttentionKind,
  type OnboardingAttentionKind,
} from "@/lib/leasing/onboarding-attention";
import type { TenancyQueueRow } from "@/lib/leasing/tenancy-staff-queue";

export type { OnboardingAttentionKind };

export type OnboardingQueueRow = TenancyQueueRow & {
  leaseStartDate: string;
  portalAccessEnabled: boolean | null;
};

export type OnboardingAttentionRow = {
  kind: OnboardingAttentionKind;
  badgeLabel: string;
  href: string;
  sortAt: string;
  tenantLabel: string | null;
  propertyName: string;
  unitLabel: string;
  moveInDate: string | null;
  leaseStartDate: string;
  portalAccessEnabled: boolean | null;
  tenancy: OnboardingQueueRow;
};

const BADGE_LABELS: Record<OnboardingAttentionKind, string> = {
  overdue: "Overdue move-in",
  upcoming: "Upcoming move-in",
  portal_not_ready: "Portal not ready",
  pending: "Pending move-in",
};

function formatTenantLabel(
  contacts: { contactType: string; firstName: string; lastName: string; email: string }[],
): string | null {
  const tenant = contacts.find((c) => c.contactType === "tenant") ?? contacts[0] ?? null;
  if (!tenant) return null;
  const name = [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim();
  return name || tenant.email;
}

function primaryPortalAccess(
  contacts: { contactType: string; portalAccessEnabled: boolean }[],
): boolean | null {
  const primary = contacts.find((c) => c.contactType === "tenant") ?? contacts[0] ?? null;
  if (!primary) return null;
  return primary.portalAccessEnabled;
}

function toAttentionRow(tenancy: OnboardingQueueRow): OnboardingAttentionRow {
  const kind = classifyOnboardingAttentionKind(tenancy);
  return {
    kind,
    badgeLabel: BADGE_LABELS[kind],
    href: `/leasing/tenancies/${tenancy.id}`,
    sortAt: tenancy.moveInDate ?? tenancy.createdAt,
    tenantLabel: tenancy.tenantLabel,
    propertyName: tenancy.propertyName,
    unitLabel: tenancy.unitLabel,
    moveInDate: tenancy.moveInDate,
    leaseStartDate: tenancy.leaseStartDate,
    portalAccessEnabled: tenancy.portalAccessEnabled,
    tenancy,
  };
}

const KIND_SORT_ORDER: Record<OnboardingAttentionKind, number> = {
  overdue: 0,
  upcoming: 1,
  portal_not_ready: 2,
  pending: 3,
};

export async function listOnboardingQueueForStaff(
  ctx: StaffContext,
): Promise<OnboardingQueueRow[]> {
  const properties = await listPropertiesForUser(prisma, ctx);
  const rows: OnboardingQueueRow[] = [];

  for (const property of properties) {
    let tenancies;
    try {
      tenancies = await listTenanciesForProperty(prisma, ctx, property.id, {
        status: "pending_move_in",
      });
    } catch (e) {
      if (e instanceof ForbiddenError) continue;
      throw e;
    }

    if (tenancies.length === 0) continue;

    const unitIds = [...new Set(tenancies.map((t) => t.unitId))];
    const tenancyIds = tenancies.map((t) => t.id);

    const [units, contacts] = await Promise.all([
      prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, unitNumber: true },
      }),
      prisma.tenancyContact.findMany({
        where: { tenancyId: { in: tenancyIds } },
        select: {
          tenancyId: true,
          contactType: true,
          firstName: true,
          lastName: true,
          email: true,
          portalAccessEnabled: true,
        },
        orderBy: [{ contactType: "asc" }, { lastName: "asc" }],
      }),
    ]);

    const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));
    const contactsByTenancy = new Map<string, typeof contacts>();
    for (const c of contacts) {
      const list = contactsByTenancy.get(c.tenancyId) ?? [];
      list.push(c);
      contactsByTenancy.set(c.tenancyId, list);
    }

    for (const t of tenancies) {
      const unitNumber = unitById.get(t.unitId);
      const tenancyContacts = contactsByTenancy.get(t.id) ?? [];
      rows.push({
        id: t.id,
        status: t.status,
        propertyId: property.id,
        propertyName: property.name,
        unitLabel: unitNumber ? `Unit ${unitNumber}` : "Unit",
        tenantLabel: formatTenantLabel(tenancyContacts),
        moveInDate: t.moveInDate.toISOString().slice(0, 10),
        leaseStartDate: t.leaseStartDate.toISOString().slice(0, 10),
        monthlyRent: t.monthlyRent.toString(),
        createdAt: t.createdAt.toISOString(),
        portalAccessEnabled: primaryPortalAccess(tenancyContacts),
      });
    }
  }

  rows.sort((a, b) => {
    const aDate = a.moveInDate ?? "";
    const bDate = b.moveInDate ?? "";
    return aDate.localeCompare(bDate);
  });

  return rows;
}

export async function listOnboardingAttentionForStaff(
  ctx: StaffContext,
): Promise<OnboardingAttentionRow[]> {
  const rows = await listOnboardingQueueForStaff(ctx);
  const attention = rows.map(toAttentionRow);

  attention.sort((a, b) => {
    const tier = KIND_SORT_ORDER[a.kind] - KIND_SORT_ORDER[b.kind];
    if (tier !== 0) return tier;
    return (a.moveInDate ?? "").localeCompare(b.moveInDate ?? "");
  });

  return attention;
}
