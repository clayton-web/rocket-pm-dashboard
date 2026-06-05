export const RENTAL_AD_FURNISHED_VALUES = ["furnished", "unfurnished", "partial"] as const;
export type RentalAdFurnished = (typeof RENTAL_AD_FURNISHED_VALUES)[number];

export const RENTAL_AD_CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
export type RentalAdConfidence = (typeof RENTAL_AD_CONFIDENCE_VALUES)[number];

/** PM-entered temporary ad details — stored in draft inputsJson only, not on Property/Unit. */
export type RentalAdAssistantInputs = {
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  parking: string;
  utilitiesIncluded: string[];
  petPolicy: string;
  furnished: RentalAdFurnished;
  availableDate: string;
  notes?: string;
  /** PM advertising anchor — not official rent. */
  targetRentHint?: number;
};

/** AI-generated + PM-edited advertising content — not official rent. */
export type RentalAdAssistantOutput = {
  suggestedAdvertisingRent: {
    conservative: number;
    recommended: number;
    aggressive: number;
    currency: "CAD";
  };
  confidence: RentalAdConfidence;
  confidenceReason: string;
  explanation: string;
  headline: string;
  fullDescription: string;
  shortDescription: string;
  valueAddSuggestions: string[];
  reviewFlags?: string[];
};

/** Snapshot of historical lease comps — not suggested asking rent. */
export type RentalAdAssistantCompsSnapshot = {
  label: string;
  count: number;
  median: number | null;
  min: number | null;
  max: number | null;
  samples: Array<{
    propertyDisplay: string;
    bedrooms: number | null;
    monthlyLeaseRent: number;
    leaseStartDate: string;
  }>;
  query: {
    city: string;
    bedroomsMin: number;
    bedroomsMax: number;
    monthsBack?: number;
  };
};

function parseRequiredString(
  value: unknown,
  field: string,
  maxLen: number,
): string | { error: string } {
  if (typeof value !== "string") return { error: `${field} is required` };
  const trimmed = value.trim();
  if (!trimmed) return { error: `${field} is required` };
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed;
}

function parseOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
): string | undefined | { error: string } {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed;
}

function parsePositiveNumber(value: unknown, field: string): number | { error: string } {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { error: `${field} must be a positive number` };
  }
  return n;
}

function parseNonNegativeInt(value: unknown, field: string, max: number): number | { error: string } {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    return { error: `${field} must be a whole number between 0 and ${max}` };
  }
  return n;
}

function parseStringArray(value: unknown, field: string): string[] | { error: string } {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) return { error: `${field} must be an array` };
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return { error: `Invalid ${field} entry` };
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > 80) return { error: `${field} entry is too long` };
    items.push(trimmed);
  }
  return items;
}

export function parseRentalAdAssistantInputs(
  body: unknown,
): RentalAdAssistantInputs | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid draft inputs" };
  }
  const raw = body as Record<string, unknown>;

  const propertyType = parseRequiredString(raw.propertyType, "Property type", 80);
  if (typeof propertyType === "object") return propertyType;

  const bedrooms = parseNonNegativeInt(raw.bedrooms, "Bedrooms", 50);
  if (typeof bedrooms === "object") return bedrooms;

  const bathrooms = parsePositiveNumber(raw.bathrooms, "Bathrooms");
  if (typeof bathrooms === "object") return bathrooms;

  const sqft = parsePositiveNumber(raw.sqft, "Square footage");
  if (typeof sqft === "object") return sqft;

  const parking = parseRequiredString(raw.parking, "Parking", 120);
  if (typeof parking === "object") return parking;

  const utilitiesIncluded = parseStringArray(raw.utilitiesIncluded, "Utilities included");
  if (typeof utilitiesIncluded === "object" && "error" in utilitiesIncluded) return utilitiesIncluded;

  const petPolicy = parseRequiredString(raw.petPolicy, "Pet policy", 120);
  if (typeof petPolicy === "object") return petPolicy;

  if (
    typeof raw.furnished !== "string" ||
    !(RENTAL_AD_FURNISHED_VALUES as readonly string[]).includes(raw.furnished)
  ) {
    return { error: "Furnished must be furnished, unfurnished, or partial" };
  }

  const availableDate = parseRequiredString(raw.availableDate, "Available date", 40);
  if (typeof availableDate === "object") return availableDate;

  const notes = parseOptionalString(raw.notes, "Notes", 2000);
  if (notes !== undefined && typeof notes === "object") return notes;

  let targetRentHint: number | undefined;
  if (raw.targetRentHint !== undefined && raw.targetRentHint !== null && raw.targetRentHint !== "") {
    const hint = parsePositiveNumber(raw.targetRentHint, "Target rent hint");
    if (typeof hint === "object") return hint;
    targetRentHint = hint;
  }

  return {
    propertyType,
    bedrooms,
    bathrooms,
    sqft,
    parking,
    utilitiesIncluded,
    petPolicy,
    furnished: raw.furnished as RentalAdFurnished,
    availableDate,
    notes,
    targetRentHint,
  };
}

function parseSuggestedAdvertisingRent(
  value: unknown,
): RentalAdAssistantOutput["suggestedAdvertisingRent"] | { error: string } {
  if (typeof value !== "object" || value === null) {
    return { error: "Suggested advertising rent is required" };
  }
  const raw = value as Record<string, unknown>;

  const conservative = parsePositiveNumber(raw.conservative, "Conservative rent");
  if (typeof conservative === "object") return conservative;

  const recommended = parsePositiveNumber(raw.recommended, "Recommended rent");
  if (typeof recommended === "object") return recommended;

  const aggressive = parsePositiveNumber(raw.aggressive, "Aggressive rent");
  if (typeof aggressive === "object") return aggressive;

  const currencyRaw =
    typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : raw.currency;
  if (currencyRaw !== "CAD") {
    return { error: "Suggested advertising rent currency must be CAD" };
  }

  return { conservative, recommended, aggressive, currency: "CAD" };
}

export function parseRentalAdAssistantOutput(
  body: unknown,
): RentalAdAssistantOutput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid draft output" };
  }
  const raw = body as Record<string, unknown>;

  const suggestedAdvertisingRent = parseSuggestedAdvertisingRent(raw.suggestedAdvertisingRent);
  if (typeof suggestedAdvertisingRent === "object" && "error" in suggestedAdvertisingRent) {
    return suggestedAdvertisingRent;
  }

  const confidenceRaw = typeof raw.confidence === "string" ? raw.confidence.trim().toLowerCase() : raw.confidence;
  if (
    typeof confidenceRaw !== "string" ||
    !(RENTAL_AD_CONFIDENCE_VALUES as readonly string[]).includes(confidenceRaw)
  ) {
    return { error: "Confidence must be high, medium, or low" };
  }

  const confidenceReason = parseRequiredString(raw.confidenceReason, "Confidence reason", 500);
  if (typeof confidenceReason === "object") return confidenceReason;

  const explanation = parseRequiredString(raw.explanation, "Explanation", 8000);
  if (typeof explanation === "object") return explanation;

  const headline = parseRequiredString(raw.headline, "Headline", 200);
  if (typeof headline === "object") return headline;

  const fullDescription = parseRequiredString(raw.fullDescription, "Full description", 12000);
  if (typeof fullDescription === "object") return fullDescription;

  const shortDescription = parseRequiredString(raw.shortDescription, "Short description", 4000);
  if (typeof shortDescription === "object") return shortDescription;

  const valueAddSuggestions = parseStringArray(raw.valueAddSuggestions, "Value-add suggestions");
  if (typeof valueAddSuggestions === "object" && "error" in valueAddSuggestions) {
    return valueAddSuggestions;
  }

  let reviewFlags: string[] | undefined;
  if (raw.reviewFlags !== undefined && raw.reviewFlags !== null) {
    const parsedFlags = parseStringArray(raw.reviewFlags, "Review flags");
    if (typeof parsedFlags === "object" && "error" in parsedFlags) return parsedFlags;
    reviewFlags = parsedFlags;
  }

  return {
    suggestedAdvertisingRent,
    confidence: confidenceRaw as RentalAdConfidence,
    confidenceReason,
    explanation,
    headline,
    fullDescription,
    shortDescription,
    valueAddSuggestions,
    reviewFlags,
  };
}

export function parseRentalAdAssistantCompsSnapshot(
  body: unknown,
): RentalAdAssistantCompsSnapshot | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid comps snapshot" };
  }
  const raw = body as Record<string, unknown>;

  const label = parseRequiredString(raw.label, "Comps label", 200);
  if (typeof label === "object") return label;

  const count =
    typeof raw.count === "number" && Number.isInteger(raw.count) && raw.count >= 0
      ? raw.count
      : { error: "Comps count must be a non-negative integer" };
  if (typeof count === "object") return count;

  function parseNullableMoney(value: unknown, field: string): number | null | { error: string } {
    if (value === null || value === undefined) return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 0) return { error: `${field} must be a non-negative number` };
    return n;
  }

  const median = parseNullableMoney(raw.median, "Median");
  if (typeof median === "object" && median !== null && "error" in median) return median;

  const min = parseNullableMoney(raw.min, "Minimum");
  if (typeof min === "object" && min !== null && "error" in min) return min;

  const max = parseNullableMoney(raw.max, "Maximum");
  if (typeof max === "object" && max !== null && "error" in max) return max;

  if (!Array.isArray(raw.samples)) return { error: "Comps samples must be an array" };
  const samples: RentalAdAssistantCompsSnapshot["samples"] = [];
  for (const sample of raw.samples) {
    if (typeof sample !== "object" || sample === null) {
      return { error: "Invalid comps sample" };
    }
    const s = sample as Record<string, unknown>;
    const propertyDisplay = parseRequiredString(s.propertyDisplay, "Property display", 300);
    if (typeof propertyDisplay === "object") return propertyDisplay;

    let bedrooms: number | null = null;
    if (s.bedrooms !== undefined && s.bedrooms !== null) {
      const b = parseNonNegativeInt(s.bedrooms, "Sample bedrooms", 50);
      if (typeof b === "object") return b;
      bedrooms = b;
    }

    const monthlyLeaseRent = parsePositiveNumber(s.monthlyLeaseRent, "Monthly lease rent");
    if (typeof monthlyLeaseRent === "object") return monthlyLeaseRent;

    const leaseStartDate = parseRequiredString(s.leaseStartDate, "Lease start date", 40);
    if (typeof leaseStartDate === "object") return leaseStartDate;

    samples.push({ propertyDisplay, bedrooms, monthlyLeaseRent, leaseStartDate });
  }

  if (typeof raw.query !== "object" || raw.query === null) {
    return { error: "Comps query is required" };
  }
  const q = raw.query as Record<string, unknown>;
  const city = parseRequiredString(q.city, "Comps city", 120);
  if (typeof city === "object") return city;

  const bedroomsMin = parseNonNegativeInt(q.bedroomsMin, "Bedrooms min", 50);
  if (typeof bedroomsMin === "object") return bedroomsMin;

  const bedroomsMax = parseNonNegativeInt(q.bedroomsMax, "Bedrooms max", 50);
  if (typeof bedroomsMax === "object") return bedroomsMax;

  if (bedroomsMin > bedroomsMax) {
    return { error: "Bedrooms min cannot exceed bedrooms max" };
  }

  let monthsBack: number | undefined;
  if (q.monthsBack !== undefined && q.monthsBack !== null) {
    const mb =
      typeof q.monthsBack === "number" ? q.monthsBack : Number(q.monthsBack);
    if (!Number.isInteger(mb) || mb <= 0) {
      return { error: "Comps monthsBack must be a positive integer" };
    }
    monthsBack = mb;
  }

  return {
    label,
    count,
    median,
    min,
    max,
    samples,
    query: { city, bedroomsMin, bedroomsMax, monthsBack },
  };
}
