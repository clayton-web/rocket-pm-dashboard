import { BriefingSourceType } from "@prisma/client";

/**
 * MVP: only synced Gmail/email threads feed the Daily Briefing.
 * Future: Buildium API (rents, deposits, arrears, ledgers) and operational
 * sources (maintenance records, applications, etc.) plug in via BriefingSourceType.
 */
export const BRIEFING_MVP_ACTIVE_SOURCE_TYPES: readonly BriefingSourceType[] = [
  BriefingSourceType.EMAIL,
] as const;

/** Reserved for Buildium / accounting integration — not active in MVP. */
export const BRIEFING_FUTURE_FINANCIAL_SOURCE_TYPES: readonly BriefingSourceType[] = [
  BriefingSourceType.RENT_PAYMENT,
  BriefingSourceType.DEPOSIT,
] as const;

/** Reserved for operational domain records — not active in MVP (email may mention these topics). */
export const BRIEFING_FUTURE_OPERATIONAL_SOURCE_TYPES: readonly BriefingSourceType[] = [
  BriefingSourceType.MAINTENANCE,
  BriefingSourceType.APPLICATION,
  BriefingSourceType.VIEWING_REQUEST,
  BriefingSourceType.INSPECTION,
  BriefingSourceType.NOTICE,
  BriefingSourceType.MOVE_OUT,
  BriefingSourceType.VACANCY,
  BriefingSourceType.SYSTEM,
] as const;

export const BRIEFING_DATA_PROVENANCE = {
  /** Subject/snippet/email content only — not verified accounting or ledger data. */
  EMAIL_MENTION: "EMAIL_MENTION",
  /** Future: Buildium or other accounting system records. */
  ACCOUNTING_SYSTEM: "ACCOUNTING_SYSTEM",
  /** Future: Rocket PM domain records (MaintenanceRequest, Application, etc.). */
  OPERATIONAL_SYSTEM: "OPERATIONAL_SYSTEM",
} as const;

export type BriefingDataProvenance =
  (typeof BRIEFING_DATA_PROVENANCE)[keyof typeof BRIEFING_DATA_PROVENANCE];

export const BRIEFING_MVP_SCOPE_NOTE =
  "EMAIL-only MVP. Rent/deposit/payment references are email mentions, not accounting data. Buildium integration is future-ready only.";

export function isMvpActiveBriefingSourceType(sourceType: BriefingSourceType): boolean {
  return BRIEFING_MVP_ACTIVE_SOURCE_TYPES.includes(sourceType);
}

export function isFutureFinancialBriefingSourceType(sourceType: BriefingSourceType): boolean {
  return BRIEFING_FUTURE_FINANCIAL_SOURCE_TYPES.includes(sourceType);
}
