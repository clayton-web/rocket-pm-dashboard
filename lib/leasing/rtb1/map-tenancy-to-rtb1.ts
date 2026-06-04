import type { Property, Tenancy, TenancyContact, Unit } from "@prisma/client";
import type { LeaseSetupJson, OrganizationLandlordProfile } from "@/lib/leasing/lease-setup";
import { RTB1_FIELD_MAP, type Rtb1LogicalFieldKey } from "./field-map";
import { rtb1Checkbox, rtb1Text, type Rtb1FieldValue, type Rtb1PdfFieldValues } from "./field-values";

export type Rtb1TenantContact = Pick<
  TenancyContact,
  "firstName" | "lastName" | "email" | "phone" | "contactType"
>;

export type MapTenancyToRtb1Input = {
  org: OrganizationLandlordProfile;
  property: Pick<Property, "streetLine1" | "streetLine2" | "city" | "province" | "postalCode">;
  unit: Pick<Unit, "unitNumber">;
  tenancy: Pick<
    Tenancy,
    "leaseStartDate" | "leaseEndDate" | "rentDueDay" | "monthlyRent" | "securityDeposit" | "petDeposit"
  >;
  leaseSetup: LeaseSetupJson;
  tenantContacts: Rtb1TenantContact[];
};

function formatMoney(amount: number): string {
  return amount.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDisplayDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function splitDateParts(date: Date): { day: string; month: string; year: string } {
  const day = String(date.getUTCDate());
  const month = date.toLocaleDateString("en-CA", { month: "long", timeZone: "UTC" });
  const year = String(date.getUTCFullYear());
  return { day, month, year };
}

function ordinalDueDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function setLogical(
  logical: Partial<Record<Rtb1LogicalFieldKey, Rtb1FieldValue>>,
  key: Rtb1LogicalFieldKey,
  value: Rtb1FieldValue | undefined,
): void {
  if (value !== undefined) {
    logical[key] = value;
  }
}

function agreementContacts(contacts: Rtb1TenantContact[]): Rtb1TenantContact[] {
  return contacts.filter((c) => c.contactType === "tenant" || c.contactType === "co_tenant");
}

export function mapTenancyToRtb1LogicalFields(
  input: MapTenancyToRtb1Input,
): Partial<Record<Rtb1LogicalFieldKey, Rtb1FieldValue>> {
  const { org, property, unit, tenancy, leaseSetup } = input;
  const logical: Partial<Record<Rtb1LogicalFieldKey, Rtb1FieldValue>> = {};

  const landlordName = org.landlordLegalName?.trim() ?? "";
  setLogical(logical, "landlord.lastNameOrBusiness", rtb1Text(landlordName));

  const serviceStreet = org.landlordServiceStreetLine1?.trim() ?? "";
  setLogical(logical, "landlord.serviceUnitSite", rtb1Text(org.landlordServiceStreetLine2?.trim() ?? ""));
  setLogical(logical, "landlord.serviceStreet", rtb1Text(serviceStreet));
  setLogical(logical, "landlord.serviceCity", rtb1Text(org.landlordServiceCity?.trim() ?? ""));
  setLogical(logical, "landlord.serviceProvince", rtb1Text(org.landlordServiceProvince?.trim() ?? ""));
  setLogical(logical, "landlord.servicePostalCode", rtb1Text(org.landlordServicePostalCode?.trim() ?? ""));
  setLogical(logical, "landlord.servicePhone", rtb1Text(org.landlordServicePhone?.trim() ?? ""));
  if (org.landlordServiceEmail?.trim()) {
    setLogical(logical, "landlord.serviceEmail", rtb1Text(org.landlordServiceEmail.trim()));
  }

  setLogical(logical, "landlord.isLandlordCheckbox", rtb1Checkbox(!org.landlordIsAgent));
  setLogical(logical, "landlord.isAgentServiceCheckbox", rtb1Checkbox(org.landlordIsAgent));

  setLogical(logical, "rentalUnit.unitNumber", rtb1Text(unit.unitNumber));
  const rentalStreet = [property.streetLine1.trim()];
  if (property.streetLine2?.trim()) {
    rentalStreet.push(property.streetLine2.trim());
  }
  setLogical(logical, "rentalUnit.street", rtb1Text(rentalStreet.join(", ")));
  setLogical(logical, "rentalUnit.city", rtb1Text(property.city));
  setLogical(logical, "rentalUnit.province", rtb1Text(property.province));
  setLogical(logical, "rentalUnit.postalCode", rtb1Text(property.postalCode));

  const signers = agreementContacts(input.tenantContacts);
  const tenant1 = signers[0];
  const tenant2 = signers[1];
  if (tenant1) {
    setLogical(logical, "tenant1.lastName", rtb1Text(tenant1.lastName.trim()));
    setLogical(logical, "tenant1.firstMiddle", rtb1Text(tenant1.firstName.trim()));
    setLogical(logical, "tenant1.email", rtb1Text(tenant1.email.trim()));
    if (tenant1.phone?.trim()) {
      setLogical(logical, "tenant1.phone", rtb1Text(tenant1.phone.trim()));
    }
  }
  if (tenant2) {
    setLogical(logical, "tenant2.lastName", rtb1Text(tenant2.lastName.trim()));
    setLogical(logical, "tenant2.firstMiddle", rtb1Text(tenant2.firstName.trim()));
    setLogical(logical, "tenant2.email", rtb1Text(tenant2.email.trim()));
    if (tenant2.phone?.trim()) {
      setLogical(logical, "tenant2.phone", rtb1Text(tenant2.phone.trim()));
    }
  }
  if (signers.length > 2) {
    setLogical(logical, "parties.rtb26Attached", rtb1Checkbox(true));
  }

  const startParts = splitDateParts(tenancy.leaseStartDate);
  setLogical(logical, "tenancy.startDay", rtb1Text(startParts.day));
  setLogical(logical, "tenancy.startMonth", rtb1Text(startParts.month));
  setLogical(logical, "tenancy.startYear", rtb1Text(startParts.year));

  if (leaseSetup.tenancyType === "month_to_month") {
    setLogical(logical, "tenancy.typeMonthToMonth", rtb1Checkbox(true));
  } else if (leaseSetup.tenancyType === "fixed_term") {
    setLogical(logical, "tenancy.typeFixedTerm", rtb1Checkbox(true));
    if (tenancy.leaseEndDate) {
      const endParts = splitDateParts(tenancy.leaseEndDate);
      setLogical(logical, "tenancy.fixedTermEndDay", rtb1Text(endParts.day));
      setLogical(logical, "tenancy.fixedTermEndMonth", rtb1Text(endParts.month));
      setLogical(logical, "tenancy.fixedTermEndYear", rtb1Text(endParts.year));
    }
    if (leaseSetup.fixedTermEndBehavior === "continue") {
      setLogical(logical, "tenancy.continueMonthToMonthAfterFixed", rtb1Checkbox(true));
    } else if (leaseSetup.fixedTermEndBehavior === "vacate") {
      setLogical(logical, "tenancy.vacateAtEnd", rtb1Checkbox(true));
      if (leaseSetup.vacateReason?.trim()) {
        setLogical(logical, "tenancy.vacateReason", rtb1Text(leaseSetup.vacateReason.trim()));
      }
      if (leaseSetup.vacateRtrSection?.trim()) {
        setLogical(logical, "tenancy.vacateRtrSection", rtb1Text(leaseSetup.vacateRtrSection.trim()));
      }
    }
  }

  setLogical(logical, "rent.amount", rtb1Text(`$${formatMoney(Number(tenancy.monthlyRent))}`));
  setLogical(logical, "rent.dueDayOfPeriod", rtb1Text(ordinalDueDay(tenancy.rentDueDay)));

  if (leaseSetup.rentPeriod === "month") {
    setLogical(logical, "rent.periodMonth", rtb1Checkbox(true));
    setLogical(logical, "rent.periodMonthRta", rtb1Checkbox(true));
  } else if (leaseSetup.rentPeriod === "week") {
    setLogical(logical, "rent.periodWeek", rtb1Checkbox(true));
  } else if (leaseSetup.rentPeriod === "day") {
    setLogical(logical, "rent.periodDay", rtb1Checkbox(true));
  }

  const securityAmount = Number(tenancy.securityDeposit);
  const depositLines = [`Security deposit: $${formatMoney(securityAmount)}`];
  if (leaseSetup.securityDepositDueDate) {
    depositLines.push(`due ${formatDisplayDate(leaseSetup.securityDepositDueDate)}`);
  }
  if (leaseSetup.petDepositNotApplicable) {
    depositLines.push("Pet damage deposit: not applicable");
    setLogical(logical, "deposits.petNotApplicable", rtb1Checkbox(true));
  } else if (tenancy.petDeposit != null) {
    depositLines.push(`Pet damage deposit: $${formatMoney(Number(tenancy.petDeposit))}`);
    if (leaseSetup.petDepositDueDate) {
      depositLines.push(`due ${formatDisplayDate(leaseSetup.petDepositDueDate)}`);
    }
  }
  setLogical(logical, "deposits.summary", rtb1Text(depositLines.join(". ")));

  if (leaseSetup.securityDepositDueDate) {
    setLogical(
      logical,
      "deposits.securityDueDate",
      rtb1Text(formatDisplayDate(leaseSetup.securityDepositDueDate)),
    );
  }
  if (leaseSetup.petDepositDueDate && !leaseSetup.petDepositNotApplicable) {
    setLogical(logical, "deposits.petDueDate", rtb1Text(formatDisplayDate(leaseSetup.petDepositDueDate)));
  }

  const services = leaseSetup.servicesIncluded ?? {};
  setLogical(logical, "services.water", rtb1Checkbox(services.water === true));
  setLogical(logical, "services.heat", rtb1Checkbox(services.heat === true));
  setLogical(logical, "services.electricity", rtb1Checkbox(services.electricity === true));
  setLogical(logical, "services.naturalGas", rtb1Checkbox(services.naturalGas === true));
  setLogical(logical, "services.garbageCollection", rtb1Checkbox(services.garbageCollection === true));
  setLogical(logical, "services.internet", rtb1Checkbox(services.internet === true));
  setLogical(logical, "services.cable", rtb1Checkbox(services.cable === true));
  setLogical(logical, "services.parking", rtb1Checkbox(services.parking === true));
  setLogical(logical, "services.storage", rtb1Checkbox(services.storage === true));
  setLogical(logical, "services.laundry", rtb1Checkbox(services.laundry === true));
  setLogical(logical, "services.snowRemoval", rtb1Checkbox(services.snowRemoval === true));

  if (services.parking === true && leaseSetup.parkingDescription?.trim()) {
    setLogical(logical, "services.parkingDescription", rtb1Text(leaseSetup.parkingDescription.trim()));
  }
  if (services.storage === true && leaseSetup.storageDescription?.trim()) {
    setLogical(logical, "services.storageDescription", rtb1Text(leaseSetup.storageDescription.trim()));
  }

  if (leaseSetup.addendumAttached) {
    setLogical(logical, "addendum.attached", rtb1Checkbox(true));
    if (leaseSetup.addendumPageCount != null) {
      setLogical(logical, "addendum.pageCount", rtb1Text(String(leaseSetup.addendumPageCount)));
    }
    if (leaseSetup.addendumTermCount != null) {
      setLogical(logical, "addendum.termCount", rtb1Text(String(leaseSetup.addendumTermCount)));
    }
  }

  return logical;
}

export function mapLogicalFieldsToPdfValues(
  logical: Partial<Record<Rtb1LogicalFieldKey, Rtb1FieldValue>>,
): Rtb1PdfFieldValues {
  const pdfValues: Rtb1PdfFieldValues = {};
  for (const [key, value] of Object.entries(logical) as [Rtb1LogicalFieldKey, Rtb1FieldValue][]) {
    const entry = RTB1_FIELD_MAP[key];
    if (!entry || !value) continue;
    pdfValues[entry.pdfFieldName] = value;
  }
  return pdfValues;
}

export function mapTenancyToRtb1PdfValues(input: MapTenancyToRtb1Input): Rtb1PdfFieldValues {
  return mapLogicalFieldsToPdfValues(mapTenancyToRtb1LogicalFields(input));
}
