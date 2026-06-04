import prisma from "@/lib/db/prisma";
import { buildApplicationPortalHandoff } from "@/lib/leasing/application-portal-link";
import { formatApplicationDetailStatus } from "@/lib/leasing/application-staff-detail";
import {
  formatHouseholdIncomeRange,
  formatSmokerStatus,
} from "@/lib/leasing/prospect-intake";
import {
  formatShowingOutcome,
  formatShowingStatus,
} from "@/lib/leasing/showing-staff-detail";
import { getProspectById } from "@/lib/services/prospect.service";
import { listShowingsForProspect } from "@/lib/services/showing.service";
import type { StaffContext } from "@/lib/services/staff-context";

export type AssignableStaffOption = {
  userId: string;
  label: string;
};

export type ProspectShowingRow = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  status: string;
  statusLabel: string;
  showingOutcome: string | null;
  outcomeLabel: string | null;
  assignedToLabel: string | null;
  href: string;
};

export type ProspectLinkedApplicationRow = {
  id: string;
  status: string;
  statusLabel: string;
  submittedAt: string | null;
  href: string;
};

export type ProspectStaffDetail = {
  id: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  propertyId: string;
  propertyName: string;
  unitId: string | null;
  unitLabel: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  occupantCount: number | null;
  hasPets: boolean;
  petDetails: string | null;
  smokerStatus: string | null;
  smokerStatusLabel: string | null;
  householdIncomeRange: string | null;
  householdIncomeRangeLabel: string | null;
  desiredMoveInDate: string | null;
  preferredViewingNotes: string | null;
  message: string | null;
  showings: ProspectShowingRow[];
  linkedApplications: ProspectLinkedApplicationRow[];
  assignableStaff: AssignableStaffOption[];
  applicationHandoff: ReturnType<typeof buildApplicationPortalHandoff>;
  canSchedule: boolean;
};

function formatStaffUserLabel(user: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || "Staff member";
}

function formatProspectStatus(status: string): string {
  if (status === "new") return "New";
  if (status === "archived") return "Archived";
  return status;
}

async function listAssignableStaffForProperty(
  propertyId: string,
): Promise<AssignableStaffOption[]> {
  const assignments = await prisma.userPropertyAssignment.findMany({
    where: {
      propertyId,
      role: { key: { in: ["property_manager", "field_agent"] } },
      user: { isActive: true, primaryRole: { key: { not: "tenant" } } },
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });

  const byUserId = new Map<string, AssignableStaffOption>();
  for (const assignment of assignments) {
    if (!byUserId.has(assignment.user.id)) {
      byUserId.set(assignment.user.id, {
        userId: assignment.user.id,
        label: formatStaffUserLabel(assignment.user),
      });
    }
  }
  return [...byUserId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export async function getProspectDetailForStaff(
  ctx: StaffContext,
  prospectId: string,
): Promise<ProspectStaffDetail> {
  const prospect = await getProspectById(prisma, ctx, prospectId);

  const [property, unit, showings, linkedApplications, assignableStaff] = await Promise.all([
    prisma.property.findUnique({
      where: { id: prospect.propertyId },
      select: { name: true },
    }),
    prospect.unitId
      ? prisma.unit.findUnique({
          where: { id: prospect.unitId },
          select: { unitNumber: true },
        })
      : Promise.resolve(null),
    listShowingsForProspect(prisma, ctx, prospectId),
    prisma.application.findMany({
      where: { prospectId: prospect.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        submittedAt: true,
      },
    }),
    listAssignableStaffForProperty(prospect.propertyId),
  ]);

  if (!property) {
    throw new Error("Property not found");
  }

  const unitLabel = unit ? `Unit ${unit.unitNumber}` : null;
  const assigneeIds = [
    ...new Set(showings.map((s) => s.assignedToUserId).filter(Boolean)),
  ] as string[];
  const assignees =
    assigneeIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
  const assigneeById = new Map(assignees.map((u) => [u.id, formatStaffUserLabel(u)]));

  return {
    id: prospect.id,
    status: prospect.status,
    statusLabel: formatProspectStatus(prospect.status),
    createdAt: prospect.createdAt.toISOString(),
    propertyId: prospect.propertyId,
    propertyName: property.name,
    unitId: prospect.unitId,
    unitLabel,
    email: prospect.email,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    phone: prospect.phone,
    occupantCount: prospect.occupantCount,
    hasPets: prospect.hasPets,
    petDetails: prospect.petDetails,
    smokerStatus: prospect.smokerStatus,
    smokerStatusLabel: prospect.smokerStatus ? formatSmokerStatus(prospect.smokerStatus) : null,
    householdIncomeRange: prospect.householdIncomeRange,
    householdIncomeRangeLabel: prospect.householdIncomeRange
      ? formatHouseholdIncomeRange(prospect.householdIncomeRange)
      : null,
    desiredMoveInDate: prospect.desiredMoveInDate?.toISOString().slice(0, 10) ?? null,
    preferredViewingNotes: prospect.preferredViewingNotes,
    message: prospect.message,
    showings: showings.map((showing) => ({
      id: showing.id,
      scheduledStart: showing.scheduledStart.toISOString(),
      scheduledEnd: showing.scheduledEnd?.toISOString() ?? null,
      status: showing.status,
      statusLabel: formatShowingStatus(showing.status),
      showingOutcome: showing.showingOutcome,
      outcomeLabel: showing.showingOutcome ? formatShowingOutcome(showing.showingOutcome) : null,
      assignedToLabel: showing.assignedToUserId
        ? (assigneeById.get(showing.assignedToUserId) ?? null)
        : null,
      href: `/leasing/showings/${showing.id}`,
    })),
    linkedApplications: linkedApplications.map((app) => ({
      id: app.id,
      status: app.status,
      statusLabel: formatApplicationDetailStatus(app.status),
      submittedAt: app.submittedAt?.toISOString() ?? null,
      href: `/leasing/applications/${app.id}`,
    })),
    assignableStaff,
    applicationHandoff: buildApplicationPortalHandoff({
      propertyName: property.name,
      unitLabel,
      email: prospect.email,
    }),
    canSchedule: prospect.status === "new",
  };
}
