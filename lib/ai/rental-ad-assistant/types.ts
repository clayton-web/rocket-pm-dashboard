import type {
  RentalAdAssistantCompsSnapshot,
  RentalAdAssistantInputs,
  RentalAdAssistantOutput,
} from "@/lib/validation/rental-ad-assistant";

export const RENTAL_AD_ASSISTANT_PROMPT_VERSION = "rental-ad-assistant-v1";

export type RentalAdAssistantPropertyContext = {
  propertyId: string;
  addressDisplay: string;
  city: string;
  province: string;
  postalCode: string;
};

export type RentalAdAssistantUnitContext = {
  unitId: string;
  unitLabel: string;
  bedrooms: number | null;
};

export type GenerateRentalAdAssistantDraftInput = {
  organizationId: string;
  property: RentalAdAssistantPropertyContext;
  unit: RentalAdAssistantUnitContext;
  inputs: RentalAdAssistantInputs;
};

export type GenerateRentalAdAssistantDraftResult = {
  output: RentalAdAssistantOutput;
  compsSnapshot: RentalAdAssistantCompsSnapshot;
  model: string;
  promptVersion: typeof RENTAL_AD_ASSISTANT_PROMPT_VERSION;
};

/** Shape expected from AI JSON mode (before normalization). */
export type RentalAdGeneratedDraftRaw = {
  suggestedAdvertisingRent?: {
    conservative?: number;
    recommended?: number;
    aggressive?: number;
    currency?: string;
  };
  confidence?: string;
  confidenceReason?: string;
  explanation?: string;
  headline?: string;
  fullDescription?: string;
  shortDescription?: string;
  valueAddSuggestions?: string[];
  reviewFlags?: string[];
};
