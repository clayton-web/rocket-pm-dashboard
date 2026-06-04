import type { LeaseSetupJson, OrganizationLandlordProfile } from "./lease-setup";

export type LeaseSetupReadinessStatus =
  | "lease_setup_incomplete"
  | "lease_setup_complete"
  | "ready_for_rtb1";

export type LeaseSetupReadinessIssue = {
  field: string;
  message: string;
};

export type LeaseSetupReadinessResult = {
  status: LeaseSetupReadinessStatus;
  issues: LeaseSetupReadinessIssue[];
};

export type TenancyLeaseSnapshot = {
  leaseStartDate: Date | null;
  leaseEndDate: Date | null;
  rentDueDay: number;
  monthlyRent: number;
  securityDeposit: number;
  petDeposit: number | null;
};

const DEPOSIT_CAP_RATIO = 0.5;

function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDateString(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

export function validateOrganizationLandlordProfile(
  org: OrganizationLandlordProfile,
): LeaseSetupReadinessIssue[] {
  const issues: LeaseSetupReadinessIssue[] = [];
  if (!isNonEmpty(org.landlordLegalName)) {
    issues.push({ field: "landlordLegalName", message: "Landlord legal name is required" });
  }
  if (!isNonEmpty(org.landlordServiceStreetLine1)) {
    issues.push({ field: "landlordServiceStreetLine1", message: "Service address is required" });
  }
  if (!isNonEmpty(org.landlordServiceCity)) {
    issues.push({ field: "landlordServiceCity", message: "Service city is required" });
  }
  if (!isNonEmpty(org.landlordServiceProvince)) {
    issues.push({ field: "landlordServiceProvince", message: "Service province is required" });
  }
  if (!isNonEmpty(org.landlordServicePostalCode)) {
    issues.push({ field: "landlordServicePostalCode", message: "Service postal code is required" });
  }
  if (!isNonEmpty(org.landlordServicePhone)) {
    issues.push({ field: "landlordServicePhone", message: "Service phone is required" });
  }
  return issues;
}

export function validateDepositCaps(tenancy: TenancyLeaseSnapshot): LeaseSetupReadinessIssue[] {
  const issues: LeaseSetupReadinessIssue[] = [];
  if (tenancy.monthlyRent <= 0) return issues;

  const maxDeposit = tenancy.monthlyRent * DEPOSIT_CAP_RATIO;
  if (tenancy.securityDeposit > maxDeposit) {
    issues.push({
      field: "securityDeposit",
      message: "Security deposit cannot exceed 50% of monthly rent",
    });
  }
  if (tenancy.petDeposit != null && tenancy.petDeposit > maxDeposit) {
    issues.push({
      field: "petDeposit",
      message: "Pet deposit cannot exceed 50% of monthly rent",
    });
  }
  return issues;
}

export function validateLeaseSetupFields(
  setup: LeaseSetupJson,
  tenancy: TenancyLeaseSnapshot,
): LeaseSetupReadinessIssue[] {
  const issues: LeaseSetupReadinessIssue[] = [];

  if (!setup.tenancyType) {
    issues.push({ field: "tenancyType", message: "Tenancy type is required" });
  }
  if (!setup.rentPeriod) {
    issues.push({ field: "rentPeriod", message: "Rent period is required" });
  }
  if (setup.servicesIncluded == null) {
    issues.push({
      field: "servicesIncluded",
      message: "Services and utilities must be confirmed",
    });
  }
  if (!isValidDateString(setup.securityDepositDueDate)) {
    issues.push({
      field: "securityDepositDueDate",
      message: "Security deposit due date is required",
    });
  }

  const petsApplicable = setup.petDepositNotApplicable !== true;
  if (petsApplicable) {
    if (!isValidDateString(setup.petDepositDueDate)) {
      issues.push({ field: "petDepositDueDate", message: "Pet deposit due date is required" });
    }
    if (tenancy.petDeposit == null) {
      issues.push({ field: "petDeposit", message: "Pet deposit amount is required when pets apply" });
    }
  }

  if (tenancy.leaseStartDate == null) {
    issues.push({ field: "leaseStartDate", message: "Tenancy start date is required" });
  }
  if (tenancy.monthlyRent <= 0) {
    issues.push({ field: "monthlyRent", message: "Rent amount is required" });
  }
  if (tenancy.rentDueDay < 1 || tenancy.rentDueDay > 31) {
    issues.push({ field: "rentDueDay", message: "Rent due day is required" });
  }
  if (tenancy.securityDeposit < 0) {
    issues.push({ field: "securityDeposit", message: "Security deposit is required" });
  }

  if (setup.tenancyType === "fixed_term") {
    if (tenancy.leaseEndDate == null) {
      issues.push({ field: "leaseEndDate", message: "Fixed-term end date is required" });
    }
    if (!setup.fixedTermEndBehavior) {
      issues.push({
        field: "fixedTermEndBehavior",
        message: "Fixed-term end behavior is required",
      });
    }
    if (setup.fixedTermEndBehavior === "vacate") {
      if (!isNonEmpty(setup.vacateReason)) {
        issues.push({ field: "vacateReason", message: "Vacate reason is required" });
      }
      if (!isNonEmpty(setup.vacateRtrSection)) {
        issues.push({
          field: "vacateRtrSection",
          message: "Applicable RTA section reference is required",
        });
      }
      if (setup.vacateClauseAttested !== true) {
        issues.push({
          field: "vacateClauseAttested",
          message: "Staff attestation is required for the vacate clause",
        });
      }
    }
  }

  if (setup.servicesIncluded?.parking === true && !isNonEmpty(setup.parkingDescription)) {
    issues.push({ field: "parkingDescription", message: "Parking details are required" });
  }
  if (setup.servicesIncluded?.storage === true && !isNonEmpty(setup.storageDescription)) {
    issues.push({ field: "storageDescription", message: "Storage details are required" });
  }

  if (setup.addendumAttached === true) {
    if (setup.addendumPageCount == null || setup.addendumPageCount < 1) {
      issues.push({ field: "addendumPageCount", message: "Addendum page count is required" });
    }
    if (setup.addendumTermCount == null || setup.addendumTermCount < 1) {
      issues.push({ field: "addendumTermCount", message: "Addendum term count is required" });
    }
  }

  return issues;
}

/** True when the PM has filled the lease setup form (tenancy-side fields only). */
export function isLeaseSetupFormComplete(
  setup: LeaseSetupJson,
  tenancy: TenancyLeaseSnapshot,
): boolean {
  return validateLeaseSetupFields(setup, tenancy).length === 0;
}

export function assessLeaseSetupReadiness(opts: {
  org: OrganizationLandlordProfile;
  setup: LeaseSetupJson;
  tenancy: TenancyLeaseSnapshot;
}): LeaseSetupReadinessResult {
  const setupIssues = validateLeaseSetupFields(opts.setup, opts.tenancy);
  if (setupIssues.length > 0) {
    return { status: "lease_setup_incomplete", issues: setupIssues };
  }

  const orgIssues = validateOrganizationLandlordProfile(opts.org);
  const depositIssues = validateDepositCaps(opts.tenancy);
  const blockingIssues = [...orgIssues, ...depositIssues];

  if (blockingIssues.length > 0) {
    return { status: "lease_setup_complete", issues: blockingIssues };
  }

  return { status: "ready_for_rtb1", issues: [] };
}

export function formatLeaseSetupReadinessStatus(status: LeaseSetupReadinessStatus): string {
  if (status === "ready_for_rtb1") return "Ready For RTB-1 Generation";
  if (status === "lease_setup_complete") return "Lease Setup Complete";
  return "Lease Setup Incomplete";
}
