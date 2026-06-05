import type { RentalAdAssistantOutput } from "@/lib/validation/rental-ad-assistant";
import {
  formatListingReviewFlag,
  scanListingCopyForReview,
} from "@/lib/ai/rental-ad-assistant/scan-listing-copy";
import { INTERNAL_RENT_COMPS_LABEL } from "@/lib/leasing/internal-rent-comps";
import {
  RENTAL_AD_ASSISTANT_DISCLAIMER,
  RENTAL_AD_ASSISTANT_DRAFT_HELPER_LABEL,
  type RentalAdAssistantDraftDto,
} from "./draft-dto";

export const SUGGESTED_ADVERTISING_RENT_LABEL = "Suggested advertising rent";
export const CONSERVATIVE_RENT_LABEL = "Conservative";
export const RECOMMENDED_RENT_LABEL = "Recommended";
export const AGGRESSIVE_RENT_LABEL = "Aggressive";

export function shouldDisableRentalAdGenerate(aiGenerationConfigured: boolean): boolean {
  return !aiGenerationConfigured;
}

export function rentalAdGenerateUnavailableMessage(aiGenerationConfigured: boolean): string | null {
  if (aiGenerationConfigured) return null;
  return "Set OPENAI_API_KEY (optional: OPENAI_RENTAL_AD_MODEL) to generate advertising drafts.";
}

export function rentalAdPanelShowsDisclaimer(): string {
  return RENTAL_AD_ASSISTANT_DISCLAIMER;
}

export function rentalAdPanelShowsHistoricalCompsLabel(draft: RentalAdAssistantDraftDto | null): boolean {
  return Boolean(draft?.compsSnapshot && draft.compsSnapshot.count > 0);
}

export function rentalAdHistoricalCompsLabel(): string {
  return INTERNAL_RENT_COMPS_LABEL;
}

export function rentalAdDraftHelperLegend(): string {
  return RENTAL_AD_ASSISTANT_DRAFT_HELPER_LABEL;
}

export function formatUtilitiesForInput(utilities: string[]): string {
  return utilities.join(", ");
}

export function parseUtilitiesFromInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const RENTAL_AD_REVIEW_BANNER_MESSAGE =
  "Review suggested wording before posting. Some phrases may create fair housing / human-rights concerns.";

export const SUGGESTED_RENT_HELPER_TEXT =
  "Draft advertising guidance only — not official lease rent.";

export const HISTORICAL_COMPS_HELPER_TEXT =
  "Signed lease amounts in your portfolio — not current asking rents or guarantees.";

export const CONFIDENCE_HELPER_TEXT =
  "Confidence reflects portfolio comps and inputs — not a market guarantee.";

export function shouldShowRentalAdReviewBanner(reviewFlags: unknown): boolean {
  return Array.isArray(reviewFlags) && reviewFlags.length > 0;
}

export function coerceReviewFlagsForDisplay(reviewFlags: unknown): string[] {
  if (!Array.isArray(reviewFlags)) return [];
  return reviewFlags.filter((flag): flag is string => typeof flag === "string");
}

export type RentalAdOutputFormState = {
  headline: string;
  fullDescription: string;
  shortDescription: string;
  valueAddSuggestions: string;
};

export function coerceValueAddSuggestionsForForm(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join("\n");
  }
  if (typeof value === "string") return value;
  return "";
}

export function buildRentalAdOutputFormState(
  output: RentalAdAssistantOutput | null | undefined,
): RentalAdOutputFormState {
  return {
    headline: typeof output?.headline === "string" ? output.headline : "",
    fullDescription: typeof output?.fullDescription === "string" ? output.fullDescription : "",
    shortDescription: typeof output?.shortDescription === "string" ? output.shortDescription : "",
    valueAddSuggestions: coerceValueAddSuggestionsForForm(output?.valueAddSuggestions),
  };
}

export function hasRenderableRentalAdOutput(
  output: RentalAdAssistantOutput | null | undefined,
): output is RentalAdAssistantOutput {
  if (!output || typeof output !== "object") return false;
  const rent = output.suggestedAdvertisingRent;
  if (!rent || typeof rent !== "object") return false;
  return (
    Number.isFinite(rent.conservative) &&
    Number.isFinite(rent.recommended) &&
    Number.isFinite(rent.aggressive)
  );
}

/** Copy/save remain available even when review flags exist. */
export function rentalAdActionsAllowedWithReviewFlags(): boolean {
  return true;
}

export function formatRentalAdReviewFlagsForDisplay(reviewFlags: unknown): string[] {
  return coerceReviewFlagsForDisplay(reviewFlags).map(formatListingReviewFlag);
}

export function rentalAdReviewFlagsFromCopy(input: {
  headline?: string;
  fullDescription?: string;
  shortDescription?: string;
}): string[] {
  return scanListingCopyForReview(input);
}
