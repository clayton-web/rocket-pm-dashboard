import type { PrismaClient, TenancyStatus } from "@prisma/client";
import { formatTenancyStatus } from "@/lib/leasing/application-staff-detail";
import { formatUnitLabelOrDash } from "@/lib/property/display";
import {
  pickPrimaryTenancy,
  type PortfolioHealthTenancyInput,
} from "@/lib/property/portfolio-health";
import { getPropertyById } from "@/lib/services/property.service";
import { listTenanciesForProperty } from "@/lib/services/tenancy.service";
import type { StaffContext } from "@/lib/services/staff-context";

const CURRENT_TENANCY_STATUSES: TenancyStatus[] = [
  "pending_move_in",
  "active",
  "notice_received",
  "move_out_scheduled",
  "inspection_scheduled",
  "inspection_completed",
];

export type PropertyTenancyUnitInput = {
  id: string;
  unitNumber: string;
  floor: string | null;
  bedrooms: number | null;
  isActive: boolean;
};

export type PropertyTenancyRecordInput = {
  id: string;
  unitId: string;
  status: TenancyStatus;
  leaseStartDate: Date;
  moveInDate: Date;
  monthlyRent: number | { toString(): string };
  securityDeposit: number | { toString(): string };
  createdAt: Date;
};

export type PropertyTenancyContactInput = {
  tenancyId: string;
  contactType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

export type PropertyTenancyUnitRow = {
  unitId: string;
  unitLabel: string;
  floor: string | null;
  bedrooms: number | null;
  unitIsActive: boolean;
  occupancyStatus: "occupied" | "vacant";
  tenancyId: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  monthlyRent: string | null;
  leaseStartDate: string | null;
  tenancyStatus: TenancyStatus | null;
  tenancyStatusLabel: string | null;
};

export type PropertyTenanciesPageData = {
  units: PropertyTenancyUnitRow[];
};

function formatTenantName(
  contacts: PropertyTenancyContactInput[],
): { name: string | null; email: string | null; phone: string | null } {
  const tenant =
    contacts.find((contact) => contact.contactType === "tenant") ?? contacts[0] ?? null;
  if (!tenant) {
    return { name: null, email: null, phone: null };
  }
  const name = [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim();
  return {
    name: name || null,
    email: tenant.email.trim() || null,
    phone: tenant.phone?.trim() || null,
  };
}

function formatMoneyAmount(value: number | { toString(): string }): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function pickPrimaryTenancyForUnit(
  unitId: string,
  tenancies: PropertyTenancyRecordInput[],
): PropertyTenancyRecordInput | null {
  const unitTenancies = tenancies.filter((tenancy) => tenancy.unitId === unitId);
  if (unitTenancies.length === 0) return null;

  const inputs: PortfolioHealthTenancyInput[] = unitTenancies.map((tenancy) => ({
    status: tenancy.status,
    leaseStartDate: tenancy.leaseStartDate,
    moveInDate: tenancy.moveInDate,
    monthlyRent: Number(tenancy.monthlyRent),
    securityDeposit: Number(tenancy.securityDeposit),
    createdAt: tenancy.createdAt,
  }));
  const primary = pickPrimaryTenancy(inputs);
  if (!primary) return null;

  const primaryIndex = inputs.findIndex((row) => row === primary);
  return unitTenancies[primaryIndex] ?? null;
}

export function buildPropertyTenancyUnitRows(
  units: PropertyTenancyUnitInput[],
  tenancies: PropertyTenancyRecordInput[],
  contacts: PropertyTenancyContactInput[],
): PropertyTenancyUnitRow[] {
  const contactsByTenancy = new Map<string, PropertyTenancyContactInput[]>();
  for (const contact of contacts) {
    const list = contactsByTenancy.get(contact.tenancyId) ?? [];
    list.push(contact);
    contactsByTenancy.set(contact.tenancyId, list);
  }

  return units.map((unit) => {
    const tenancy = pickPrimaryTenancyForUnit(unit.id, tenancies);
    if (!tenancy) {
      return {
        unitId: unit.id,
        unitLabel: formatUnitLabelOrDash(unit.unitNumber),
        floor: unit.floor,
        bedrooms: unit.bedrooms,
        unitIsActive: unit.isActive,
        occupancyStatus: "vacant",
        tenancyId: null,
        tenantName: null,
        tenantEmail: null,
        tenantPhone: null,
        monthlyRent: null,
        leaseStartDate: null,
        tenancyStatus: null,
        tenancyStatusLabel: null,
      };
    }

    const tenant = formatTenantName(contactsByTenancy.get(tenancy.id) ?? []);
    return {
      unitId: unit.id,
      unitLabel: formatUnitLabelOrDash(unit.unitNumber),
      floor: unit.floor,
      bedrooms: unit.bedrooms,
      unitIsActive: unit.isActive,
      occupancyStatus: "occupied",
      tenancyId: tenancy.id,
      tenantName: tenant.name,
      tenantEmail: tenant.email,
      tenantPhone: tenant.phone,
      monthlyRent: formatMoneyAmount(tenancy.monthlyRent),
      leaseStartDate: formatIsoDate(tenancy.leaseStartDate),
      tenancyStatus: tenancy.status,
      tenancyStatusLabel: formatTenancyStatus(tenancy.status),
    };
  });
}

export async function loadPropertyTenanciesForStaff(
  prisma: PrismaClient,
  ctx: StaffContext,
  propertyId: string,
  units: PropertyTenancyUnitInput[],
): Promise<PropertyTenanciesPageData> {
  await getPropertyById(prisma, ctx, propertyId);

  if (units.length === 0) {
    return { units: [] };
  }

  const unitIds = new Set(units.map((unit) => unit.id));
  const allTenancies = await listTenanciesForProperty(prisma, ctx, propertyId);
  const tenancies = allTenancies
    .filter(
      (row) =>
        unitIds.has(row.unitId) &&
        CURRENT_TENANCY_STATUSES.includes(row.status as TenancyStatus),
    )
    .map((row) => ({
      id: row.id,
      unitId: row.unitId,
      status: row.status,
      leaseStartDate: row.leaseStartDate,
      moveInDate: row.moveInDate,
      monthlyRent: row.monthlyRent,
      securityDeposit: row.securityDeposit,
      createdAt: row.createdAt,
    }));

  const tenancyIds = tenancies.map((tenancy) => tenancy.id);
  const contacts =
    tenancyIds.length === 0
      ? []
      : await prisma.tenancyContact.findMany({
          where: { tenancyId: { in: tenancyIds } },
          select: {
            tenancyId: true,
            contactType: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
          orderBy: [{ contactType: "asc" }, { lastName: "asc" }],
        });

  return {
    units: buildPropertyTenancyUnitRows(units, tenancies, contacts),
  };
}
