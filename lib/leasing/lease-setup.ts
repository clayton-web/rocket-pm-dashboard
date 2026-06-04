import type { Prisma } from "@prisma/client";

export type TenancyType = "month_to_month" | "fixed_term";
export type RentPeriod = "day" | "week" | "month";
export type FixedTermEndBehavior = "continue" | "vacate";

/** RTB-1 services / utilities checkbox keys (PM confirms included vs tenant-paid). */
export const RTB_SERVICE_KEYS = [
  "water",
  "heat",
  "electricity",
  "naturalGas",
  "garbageCollection",
  "internet",
  "cable",
  "parking",
  "storage",
  "laundry",
  "snowRemoval",
] as const;

export type RtbServiceKey = (typeof RTB_SERVICE_KEYS)[number];

export type LeaseSetupJson = {
  tenancyType?: TenancyType;
  rentPeriod?: RentPeriod;
  fixedTermEndBehavior?: FixedTermEndBehavior;
  vacateReason?: string;
  vacateRtrSection?: string;
  vacateClauseAttested?: boolean;
  securityDepositDueDate?: string;
  petDepositDueDate?: string;
  petDepositNotApplicable?: boolean;
  servicesIncluded?: Partial<Record<RtbServiceKey, boolean>>;
  parkingDescription?: string;
  storageDescription?: string;
  addendumAttached?: boolean;
  addendumPageCount?: number;
  addendumTermCount?: number;
  occupantCount?: number;
  hasPets?: boolean;
  petDetails?: string;
};

export type OrganizationLandlordProfile = {
  landlordLegalName: string | null;
  landlordServiceStreetLine1: string | null;
  landlordServiceStreetLine2: string | null;
  landlordServiceCity: string | null;
  landlordServiceProvince: string | null;
  landlordServicePostalCode: string | null;
  landlordServicePhone: string | null;
  landlordServiceEmail: string | null;
  landlordIsAgent: boolean;
};

export const RTB_SERVICE_LABELS: Record<RtbServiceKey, string> = {
  water: "Water",
  heat: "Heat",
  electricity: "Electricity",
  naturalGas: "Natural gas",
  garbageCollection: "Garbage collection",
  internet: "Internet",
  cable: "Cable / satellite",
  parking: "Parking",
  storage: "Storage",
  laundry: "Laundry",
  snowRemoval: "Snow removal",
};

export function parseLeaseSetupJson(value: Prisma.JsonValue | null | undefined): LeaseSetupJson {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const setup: LeaseSetupJson = {};

  if (raw.tenancyType === "month_to_month" || raw.tenancyType === "fixed_term") {
    setup.tenancyType = raw.tenancyType;
  }
  if (raw.rentPeriod === "day" || raw.rentPeriod === "week" || raw.rentPeriod === "month") {
    setup.rentPeriod = raw.rentPeriod;
  }
  if (raw.fixedTermEndBehavior === "continue" || raw.fixedTermEndBehavior === "vacate") {
    setup.fixedTermEndBehavior = raw.fixedTermEndBehavior;
  }
  if (typeof raw.vacateReason === "string") setup.vacateReason = raw.vacateReason;
  if (typeof raw.vacateRtrSection === "string") setup.vacateRtrSection = raw.vacateRtrSection;
  if (typeof raw.vacateClauseAttested === "boolean") {
    setup.vacateClauseAttested = raw.vacateClauseAttested;
  }
  if (typeof raw.securityDepositDueDate === "string") {
    setup.securityDepositDueDate = raw.securityDepositDueDate;
  }
  if (typeof raw.petDepositDueDate === "string") setup.petDepositDueDate = raw.petDepositDueDate;
  if (typeof raw.petDepositNotApplicable === "boolean") {
    setup.petDepositNotApplicable = raw.petDepositNotApplicable;
  }
  if (typeof raw.parkingDescription === "string") setup.parkingDescription = raw.parkingDescription;
  if (typeof raw.storageDescription === "string") setup.storageDescription = raw.storageDescription;
  if (typeof raw.addendumAttached === "boolean") setup.addendumAttached = raw.addendumAttached;
  if (typeof raw.addendumPageCount === "number" && Number.isFinite(raw.addendumPageCount)) {
    setup.addendumPageCount = raw.addendumPageCount;
  }
  if (typeof raw.addendumTermCount === "number" && Number.isFinite(raw.addendumTermCount)) {
    setup.addendumTermCount = raw.addendumTermCount;
  }
  if (typeof raw.occupantCount === "number" && Number.isInteger(raw.occupantCount)) {
    setup.occupantCount = raw.occupantCount;
  }
  if (typeof raw.hasPets === "boolean") setup.hasPets = raw.hasPets;
  if (typeof raw.petDetails === "string") setup.petDetails = raw.petDetails;

  if (raw.servicesIncluded != null && typeof raw.servicesIncluded === "object" && !Array.isArray(raw.servicesIncluded)) {
    const services: Partial<Record<RtbServiceKey, boolean>> = {};
    for (const key of RTB_SERVICE_KEYS) {
      const v = (raw.servicesIncluded as Record<string, unknown>)[key];
      if (typeof v === "boolean") services[key] = v;
    }
    setup.servicesIncluded = services;
  }

  return setup;
}

export function emptyServicesIncluded(): Record<RtbServiceKey, boolean> {
  return Object.fromEntries(RTB_SERVICE_KEYS.map((k) => [k, false])) as Record<RtbServiceKey, boolean>;
}
