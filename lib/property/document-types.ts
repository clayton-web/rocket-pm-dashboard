import { RTB1_DOCUMENT_TYPE, RTB1_EXECUTED_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";

export type PropertyDocumentScope = "property" | "tenancy";

export type StaffPropertyDocumentType =
  | "property_misc"
  | "strata_bylaws"
  | "strata_insurance"
  | "strata_meeting"
  | "strata_form_b"
  | "property_insurance"
  | "ownership"
  | "lease_agreement"
  | "lease_addendum"
  | "move_in_inspection"
  | "move_out_inspection"
  | "tenancy_misc";

export type SystemPropertyDocumentType = typeof RTB1_DOCUMENT_TYPE | typeof RTB1_EXECUTED_DOCUMENT_TYPE;

export type PropertyDocumentType = StaffPropertyDocumentType | SystemPropertyDocumentType | string;

export const PROPERTY_LEVEL_DOCUMENT_TYPES = [
  "property_misc",
  "strata_bylaws",
  "strata_insurance",
  "strata_meeting",
  "strata_form_b",
  "property_insurance",
  "ownership",
] as const satisfies readonly StaffPropertyDocumentType[];

export const TENANCY_LEVEL_DOCUMENT_TYPES = [
  "lease_agreement",
  "lease_addendum",
  "move_in_inspection",
  "move_out_inspection",
  "tenancy_misc",
] as const satisfies readonly StaffPropertyDocumentType[];

export const SYSTEM_MANAGED_DOCUMENT_TYPES = [
  RTB1_DOCUMENT_TYPE,
  RTB1_EXECUTED_DOCUMENT_TYPE,
] as const;

export const STAFF_UPLOAD_DOCUMENT_TYPES = [
  ...PROPERTY_LEVEL_DOCUMENT_TYPES,
  ...TENANCY_LEVEL_DOCUMENT_TYPES,
] as const;

export const PROPERTY_DOCUMENT_TYPE_LABELS: Record<StaffPropertyDocumentType, string> = {
  property_misc: "Miscellaneous",
  strata_bylaws: "Strata bylaws / rules",
  strata_insurance: "Strata insurance",
  strata_meeting: "Strata meeting minutes / AGM",
  strata_form_b: "Strata Form B / information",
  property_insurance: "Property insurance",
  ownership: "Ownership / title",
  lease_agreement: "Lease agreement (uploaded)",
  lease_addendum: "Lease addendum",
  move_in_inspection: "Move-in inspection report",
  move_out_inspection: "Move-out inspection report",
  tenancy_misc: "Tenancy miscellaneous",
};

const SYSTEM_DOCUMENT_TYPE_LABELS: Record<SystemPropertyDocumentType, string> = {
  [RTB1_DOCUMENT_TYPE]: "RTB-1 draft (system)",
  [RTB1_EXECUTED_DOCUMENT_TYPE]: "Executed RTB-1 lease (system)",
};

export function isStaffUploadDocumentType(value: string): value is StaffPropertyDocumentType {
  return (STAFF_UPLOAD_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function isSystemManagedDocumentType(value: string): value is SystemPropertyDocumentType {
  return (SYSTEM_MANAGED_DOCUMENT_TYPES as readonly string[]).includes(value as SystemPropertyDocumentType);
}

export function isPropertyLevelDocumentType(value: string): value is (typeof PROPERTY_LEVEL_DOCUMENT_TYPES)[number] {
  return (PROPERTY_LEVEL_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function isTenancyLevelDocumentType(value: string): value is (typeof TENANCY_LEVEL_DOCUMENT_TYPES)[number] {
  return (TENANCY_LEVEL_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function documentTypeLabel(documentType: string): string {
  if (isStaffUploadDocumentType(documentType)) {
    return PROPERTY_DOCUMENT_TYPE_LABELS[documentType];
  }
  if (isSystemManagedDocumentType(documentType)) {
    return SYSTEM_DOCUMENT_TYPE_LABELS[documentType];
  }
  return documentType;
}

export function staffDocumentTypesForScope(scope: PropertyDocumentScope): StaffPropertyDocumentType[] {
  return scope === "property"
    ? [...PROPERTY_LEVEL_DOCUMENT_TYPES]
    : [...TENANCY_LEVEL_DOCUMENT_TYPES];
}

export function assertDocumentTypeMatchesScope(
  documentType: string,
  scope: PropertyDocumentScope,
): string | null {
  if (!isStaffUploadDocumentType(documentType)) {
    return "Invalid document category";
  }
  if (scope === "property" && !isPropertyLevelDocumentType(documentType)) {
    return "Selected category requires an active tenancy scope";
  }
  if (scope === "tenancy" && !isTenancyLevelDocumentType(documentType)) {
    return "Selected category is only valid for property-level documents";
  }
  return null;
}

export function documentScopeFromRecord(document: { tenancyId: string | null }): PropertyDocumentScope {
  return document.tenancyId ? "tenancy" : "property";
}

export function documentScopeLabel(document: { tenancyId: string | null }): string {
  return document.tenancyId ? "Active tenancy" : "Property";
}
