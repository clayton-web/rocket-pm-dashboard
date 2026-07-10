import prisma from "@/lib/db/prisma";
import {
  getApplicationConversionPolicy,
  type ApplicationConversionPolicy,
} from "@/lib/leasing/application-conversion-policy";
import {
  formatPropertyAddress,
  formatUnitLabelOrDash,
  propertyDisplaySelect,
} from "@/lib/property/display";
import {
  formatPropertyServiceRelationship,
  isPropertyServiceRelationship,
  type PropertyServiceRelationshipValue,
} from "@/lib/property/service-relationship";
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
  emergencyContactFirstName: string | null;
  emergencyContactLastName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactEmail: string | null;
  consentCreditCheck: boolean;
  consentSignatureName: string | null;
  consentSignedAt: string | null;
  tenancyId: string | null;
  tenancyStatus: string | null;
  rentalListingId: string | null;
  rentalListingHeadline: string | null;
  rentalListingMonthlyRent: string | null;
  rentalListingStatus: string | null;
  placementId: string | null;
  placementCompletedAt: string | null;
  placementLeaseStartDate: string | null;
  placementMonthlyRent: string | null;
  placementLandlordHandoffNotes: string | null;
  placementInternalNotes: string | null;
  placementListingClosed: boolean;
  canCompletePlacement: boolean;
  suggestedMonthlyRent: string | null;
  serviceRelationship: PropertyServiceRelationshipValue;
  serviceRelationshipLabel: string;
  conversionPolicy: ApplicationConversionPolicy;
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

export function formatTenancyStatus(status: string): string {
  if (status === "pending_move_in") return "Pending move-in";
  if (status === "active") return "Active";
  if (status === "notice_received") return "Notice received";
  if (status === "move_out_scheduled") return "Move-out scheduled";
  if (status === "inspection_scheduled") return "Inspection scheduled";
  if (status === "inspection_completed") return "Inspection completed";
  if (status === "ended") return "Ended";
  if (status === "archived") return "Archived";
  return status;
}

/** True when managed tenancy conversion is allowed for this approved application. */
export function canConvertApplicationToTenancy(detail: ApplicationStaffDetail): boolean {
  return detail.conversionPolicy.allowed && detail.placementId == null;
}

export async function getApplicationDetailForStaff(
  ctx: StaffContext,
  applicationId: string,
): Promise<ApplicationStaffDetail> {
  const app = await getApplicationById(prisma, ctx, applicationId);

  const [property, unit, tenancy, placement, listing] = await Promise.all([
    prisma.property.findUnique({
      where: { id: app.propertyId },
      select: { ...propertyDisplaySelect, serviceRelationship: true },
    }),
    prisma.unit.findUnique({
      where: { id: app.unitId },
      select: { unitNumber: true },
    }),
    prisma.tenancy.findUnique({
      where: { applicationId: app.id },
      select: { id: true, status: true },
    }),
    prisma.tenantPlacement.findUnique({
      where: { applicationId: app.id },
      select: {
        id: true,
        completedAt: true,
        leaseStartDate: true,
        monthlyRent: true,
        landlordHandoffNotes: true,
        internalNotes: true,
        rentalListingClosed: true,
      },
    }),
    app.rentalListingId
      ? prisma.rentalListing.findUnique({
          where: { id: app.rentalListingId },
          select: {
            id: true,
            headline: true,
            monthlyRent: true,
            status: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const serviceRelationship: PropertyServiceRelationshipValue =
    property?.serviceRelationship && isPropertyServiceRelationship(property.serviceRelationship)
      ? property.serviceRelationship
      : "MANAGED";

  const conversionPolicy = getApplicationConversionPolicy({
    applicationStatus: app.status,
    hasTenancy: tenancy != null,
    serviceRelationship,
  });

  const canCompletePlacement =
    app.status === "approved" &&
    tenancy == null &&
    placement == null &&
    conversionPolicy.recommendedAction === "await_placement_completion";

  return {
    id: app.id,
    status: app.status,
    submittedAt: app.submittedAt?.toISOString() ?? null,
    decisionAt: app.decisionAt?.toISOString() ?? null,
    propertyId: app.propertyId,
    propertyName: property ? formatPropertyAddress(property) : "Property",
    unitLabel: formatUnitLabelOrDash(unit?.unitNumber),
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
    emergencyContactFirstName: app.emergencyContactFirstName,
    emergencyContactLastName: app.emergencyContactLastName,
    emergencyContactPhone: app.emergencyContactPhone,
    emergencyContactEmail: app.emergencyContactEmail,
    consentCreditCheck: app.consentCreditCheck,
    consentSignatureName: app.consentSignatureName,
    consentSignedAt: app.consentSignedAt?.toISOString() ?? null,
    tenancyId: tenancy?.id ?? null,
    tenancyStatus: tenancy?.status ?? null,
    rentalListingId: listing?.id ?? app.rentalListingId,
    rentalListingHeadline: listing?.headline ?? null,
    rentalListingMonthlyRent: listing?.monthlyRent?.toString() ?? null,
    rentalListingStatus: listing?.status ?? null,
    placementId: placement?.id ?? null,
    placementCompletedAt: placement?.completedAt.toISOString() ?? null,
    placementLeaseStartDate: placement?.leaseStartDate.toISOString().slice(0, 10) ?? null,
    placementMonthlyRent: placement?.monthlyRent.toString() ?? null,
    placementLandlordHandoffNotes: placement?.landlordHandoffNotes ?? null,
    placementInternalNotes: placement?.internalNotes ?? null,
    placementListingClosed: placement?.rentalListingClosed ?? false,
    canCompletePlacement,
    suggestedMonthlyRent: listing?.monthlyRent?.toString() ?? null,
    serviceRelationship,
    serviceRelationshipLabel: formatPropertyServiceRelationship(serviceRelationship),
    conversionPolicy,
  };
}
