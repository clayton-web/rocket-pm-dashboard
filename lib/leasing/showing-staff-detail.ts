import prisma from "@/lib/db/prisma";
import { buildApplicationPortalHandoff } from "@/lib/leasing/application-portal-link";
import { formatApplicationDetailStatus } from "@/lib/leasing/application-staff-detail";
import {
  isShowingOpenForCloseOut,
  type ShowingCloseOutChoice,
} from "@/lib/leasing/showing-close-out";
import { getProspectById } from "@/lib/services/prospect.service";
import { getShowingById } from "@/lib/services/showing.service";
import type { StaffContext } from "@/lib/services/staff-context";
import type { ContactStatus, ShowingOutcome, ShowingStatus } from "@prisma/client";

export type ShowingStaffDetail = {
  id: string;
  status: string;
  statusLabel: string;
  showingOutcome: string | null;
  outcomeLabel: string | null;
  contactStatus: string;
  contactStatusLabel: string;
  contactNotes: string | null;
  scheduledStart: string;
  scheduledEnd: string | null;
  propertyId: string;
  propertyName: string;
  unitId: string | null;
  unitLabel: string | null;
  prospectId: string;
  prospectName: string;
  prospectEmail: string;
  prospectHref: string;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
  createdByLabel: string | null;
  canCloseOut: boolean;
  closeOutChoices: ShowingCloseOutChoice[];
  applicationHandoff: ReturnType<typeof buildApplicationPortalHandoff>;
  linkedApplications: {
    id: string;
    status: string;
    statusLabel: string;
    href: string;
  }[];
};

export function formatShowingStatus(status: ShowingStatus | string): string {
  if (status === "scheduled") return "Scheduled";
  if (status === "completed") return "Completed";
  if (status === "no_show") return "No-show";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export function formatShowingOutcome(outcome: ShowingOutcome | string): string {
  if (outcome === "interested") return "Interested";
  if (outcome === "not_interested") return "Not interested";
  if (outcome === "no_show") return "No-show";
  if (outcome === "reschedule") return "Reschedule requested";
  return outcome;
}

export function formatContactStatus(status: ContactStatus | string): string {
  if (status === "not_contacted") return "Not contacted";
  if (status === "contacted") return "Contacted";
  return status;
}

function formatPersonLabel(input: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return name || input.email || "Unknown";
}

export async function getShowingDetailForStaff(
  ctx: StaffContext,
  showingId: string,
): Promise<ShowingStaffDetail> {
  const showing = await getShowingById(prisma, ctx, showingId);
  await getProspectById(prisma, ctx, showing.prospectId);

  const [property, unit, prospect, assignedTo, createdBy, linkedApplications] = await Promise.all([
    prisma.property.findUnique({
      where: { id: showing.propertyId },
      select: { name: true },
    }),
    showing.unitId
      ? prisma.unit.findUnique({
          where: { id: showing.unitId },
          select: { unitNumber: true },
        })
      : Promise.resolve(null),
    prisma.prospect.findUnique({
      where: { id: showing.prospectId },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    showing.assignedToUserId
      ? prisma.user.findUnique({
          where: { id: showing.assignedToUserId },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : Promise.resolve(null),
    showing.createdByUserId
      ? prisma.user.findUnique({
          where: { id: showing.createdByUserId },
          select: { firstName: true, lastName: true, email: true },
        })
      : Promise.resolve(null),
    prisma.application.findMany({
      where: { prospectId: showing.prospectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    }),
  ]);

  if (!property || !prospect) {
    throw new Error("Showing context not found");
  }

  const unitLabel = unit ? `Unit ${unit.unitNumber}` : null;

  return {
    id: showing.id,
    status: showing.status,
    statusLabel: formatShowingStatus(showing.status),
    showingOutcome: showing.showingOutcome,
    outcomeLabel: showing.showingOutcome ? formatShowingOutcome(showing.showingOutcome) : null,
    contactStatus: showing.contactStatus,
    contactStatusLabel: formatContactStatus(showing.contactStatus),
    contactNotes: showing.contactNotes,
    scheduledStart: showing.scheduledStart.toISOString(),
    scheduledEnd: showing.scheduledEnd?.toISOString() ?? null,
    propertyId: showing.propertyId,
    propertyName: property.name,
    unitId: showing.unitId,
    unitLabel,
    prospectId: prospect.id,
    prospectName: formatPersonLabel(prospect),
    prospectEmail: prospect.email,
    prospectHref: `/leasing/prospects/${prospect.id}`,
    assignedToUserId: showing.assignedToUserId,
    assignedToLabel: assignedTo ? formatPersonLabel(assignedTo) : null,
    createdByLabel: createdBy ? formatPersonLabel(createdBy) : null,
    canCloseOut: isShowingOpenForCloseOut(showing.status),
    closeOutChoices: [
      "completed_interested",
      "completed_not_interested",
      "no_show",
      "cancelled",
      "reschedule_requested",
    ],
    applicationHandoff: buildApplicationPortalHandoff({
      propertyName: property.name,
      unitLabel,
      email: prospect.email,
    }),
    linkedApplications: linkedApplications.map((app) => ({
      id: app.id,
      status: app.status,
      statusLabel: formatApplicationDetailStatus(app.status),
      href: `/leasing/applications/${app.id}`,
    })),
  };
}
