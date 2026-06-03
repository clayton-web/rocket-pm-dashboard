import type { Prospect } from "@prisma/client";
import { formatHouseholdIncomeRange } from "@/lib/leasing/prospect-intake";

/** Safe fields returned from prospect prefill lookup (no Application data). */
export type PublicProspectPrefillFields = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  occupantCount: number | null;
  hasPets: boolean;
  petDetails: string | null;
  smokerStatus: string | null;
  desiredMoveInDate: string | null;
  householdIncomeRange: string | null;
  householdIncomeRangeLabel: string | null;
};

export type PublicProspectPrefillResponse =
  | { found: false }
  | {
      found: true;
      prospectId: string;
      prefill: PublicProspectPrefillFields;
    };

export function prospectToPrefillFields(prospect: Prospect): PublicProspectPrefillFields {
  return {
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    phone: prospect.phone,
    occupantCount: prospect.occupantCount,
    hasPets: prospect.hasPets,
    petDetails: prospect.petDetails,
    smokerStatus: prospect.smokerStatus,
    desiredMoveInDate: prospect.desiredMoveInDate?.toISOString().slice(0, 10) ?? null,
    householdIncomeRange: prospect.householdIncomeRange,
    householdIncomeRangeLabel: prospect.householdIncomeRange
      ? formatHouseholdIncomeRange(prospect.householdIncomeRange)
      : null,
  };
}

export function toPublicProspectPrefillResponse(
  prospect: Prospect | null,
): PublicProspectPrefillResponse {
  if (!prospect) return { found: false };
  return {
    found: true,
    prospectId: prospect.id,
    prefill: prospectToPrefillFields(prospect),
  };
}
