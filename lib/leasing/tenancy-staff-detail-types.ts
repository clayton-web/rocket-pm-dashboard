import type { TenancyStatus } from "@prisma/client";
import type { LeaseSetupJson } from "@/lib/leasing/lease-setup";
import type { LeaseSetupReadinessStatus } from "@/lib/leasing/lease-setup-readiness";
import type { LeaseSigningProgress } from "@/lib/leasing/lease-signing-progress";
import type {
  OffboardingNextStep,
  OffboardingStep,
} from "@/lib/leasing/offboarding-progress";
import type {
  OnboardingNextStep,
  OnboardingStep,
} from "@/lib/leasing/onboarding-progress";

export type TenancyContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  contactType: string;
  portalAccessEnabled: boolean;
};

export type Rtb1DraftDocumentRow = {
  id: string;
  title: string;
  fileName: string;
  createdAt: string;
  downloadHref: string;
};

export type LeaseSignatureAuditRow = {
  signerRole: string;
  signerName: string;
  signedAt: string;
};

export type TenancyStaffDetail = {
  id: string;
  status: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  applicationId: string;
  leaseStartDate: string;
  leaseEndDate: string | null;
  moveInDate: string;
  moveOutDate: string | null;
  monthlyRent: string;
  securityDeposit: string;
  petDeposit: string | null;
  archivedAt: string | null;
  nextStatus: TenancyStatus | null;
  advanceStatusLabel: string | null;
  acceptedNoticeId: string | null;
  requestedMoveOutDate: string | null;
  inspectionDate: string | null;
  inspectionReportUrl: string | null;
  inspectionNotes: string | null;
  canScheduleInspection: boolean;
  canCompleteInspection: boolean;
  defaultInspectionDate: string | null;
  showOffboardingSummary: boolean;
  offboardingSteps: OffboardingStep[];
  offboardingNextStep: OffboardingNextStep;
  missingAcceptedNotice: boolean;
  showOnboardingSummary: boolean;
  onboardingSteps: OnboardingStep[];
  onboardingNextStep: OnboardingNextStep;
  primaryPortalAccessEnabled: boolean | null;
  contacts: TenancyContactRow[];
  leaseSetup: LeaseSetupJson;
  leaseSetupStatus: LeaseSetupReadinessStatus;
  leaseSetupStatusLabel: string;
  rentDueDay: number;
  rtb1DraftDocuments: Rtb1DraftDocumentRow[];
  leaseSigning: LeaseSigningProgress & {
    signatures: LeaseSignatureAuditRow[];
  };
};
