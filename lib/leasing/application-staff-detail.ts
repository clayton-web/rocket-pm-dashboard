import prisma from "@/lib/db/prisma";
import { getApplicationById } from "@/lib/services/application.service";
import type { StaffContext } from "@/lib/services/staff-context";

export type ApplicationStaffDetail = {
  id: string;
  status: string;
  submittedAt: string | null;
  decisionAt: string | null;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  prospectId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  currentAddress: string | null;
  desiredMoveInDate: string | null;
  occupantCount: number | null;
  monthlyIncome: string | null;
  hasPets: boolean;
  petDetails: string | null;
  smokerStatus: string | null;
  employerName: string | null;
  jobTitle: string | null;
  employmentNotes: string | null;
  consentCreditCheck: boolean;
  consentSignatureName: string | null;
  consentSignedAt: string | null;
};

export function formatApplicationDetailStatus(status: string): string {
  if (status === "under_review") return "Under review";
  if (status === "submitted") return "Submitted";
  if (status === "approved") return "Approved";
  if (status === "declined") return "Declined";
  if (status === "draft") return "Draft";
  if (status === "withdrawn") return "Withdrawn";
  return status;
}

export function isApplicationReviewable(status: string): boolean {
  return status === "submitted" || status === "under_review";
}

export async function getApplicationDetailForStaff(
  ctx: StaffContext,
  applicationId: string,
): Promise<ApplicationStaffDetail> {
  const app = await getApplicationById(prisma, ctx, applicationId);

  const [property, unit] = await Promise.all([
    prisma.property.findUnique({
      where: { id: app.propertyId },
      select: { name: true },
    }),
    prisma.unit.findUnique({
      where: { id: app.unitId },
      select: { unitNumber: true },
    }),
  ]);

  return {
    id: app.id,
    status: app.status,
    submittedAt: app.submittedAt?.toISOString() ?? null,
    decisionAt: app.decisionAt?.toISOString() ?? null,
    propertyId: app.propertyId,
    propertyName: property?.name ?? "Property",
    unitLabel: unit?.unitNumber ? `Unit ${unit.unitNumber}` : "Unit",
    prospectId: app.prospectId,
    firstName: app.firstName,
    lastName: app.lastName,
    email: app.email,
    phone: app.phone,
    currentAddress: app.currentAddress,
    desiredMoveInDate: app.desiredMoveInDate?.toISOString().slice(0, 10) ?? null,
    occupantCount: app.occupantCount,
    monthlyIncome: app.monthlyIncome?.toString() ?? null,
    hasPets: app.hasPets,
    petDetails: app.petDetails,
    smokerStatus: app.smokerStatus,
    employerName: app.employerName,
    jobTitle: app.jobTitle,
    employmentNotes: app.employmentNotes,
    consentCreditCheck: app.consentCreditCheck,
    consentSignatureName: app.consentSignatureName,
    consentSignedAt: app.consentSignedAt?.toISOString() ?? null,
  };
}
