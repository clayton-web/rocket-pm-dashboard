import type { Application } from "@prisma/client";

/** Fields safe to return from public application APIs (no staff review metadata). */
export type PublicApplicationPayload = {
  id: string;
  propertyId: string;
  unitId: string;
  email: string;
  status: Application["status"];
  firstName: string | null;
  lastName: string | null;
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
  submittedAt: string | null;
};

export function toPublicApplicationPayload(app: Application): PublicApplicationPayload {
  return {
    id: app.id,
    propertyId: app.propertyId,
    unitId: app.unitId,
    email: app.email,
    status: app.status,
    firstName: app.firstName,
    lastName: app.lastName,
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
    submittedAt: app.submittedAt?.toISOString() ?? null,
  };
}

export function getRequestClientMeta(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded
    ? (forwarded.split(",")[0]?.trim() || null)
    : request.headers.get("x-real-ip")?.trim() || null;
  const userAgent = request.headers.get("user-agent")?.trim() || null;
  return { ipAddress, userAgent };
}
