export const MARKET_RENT_FURNISHED_VALUES = ["furnished", "unfurnished", "partial"] as const;
export type MarketRentFurnished = (typeof MARKET_RENT_FURNISHED_VALUES)[number];

export const MARKET_RENT_CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
export type MarketRentConfidence = (typeof MARKET_RENT_CONFIDENCE_VALUES)[number];

export const MARKET_RENT_SOURCE_IDS = ["craigslist", "rew"] as const;
export type MarketRentSourceId = (typeof MARKET_RENT_SOURCE_IDS)[number];

/** PM-entered research criteria — not official Property/Unit fields. */
export type MarketRentResearchInputs = {
  city: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  neighbourhood?: string;
  sqft?: number;
  parking?: string;
  furnished?: MarketRentFurnished;
  petPolicy?: string;
  notes?: string;
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

export function parseMarketRentResearchInputs(
  body: unknown,
): MarketRentResearchInputs | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid research inputs" };
  }
  const raw = body as Record<string, unknown>;

  const city = parseRequiredString(raw.city, "City", 80);
  if (typeof city === "object") return city;

  const propertyType = parseRequiredString(raw.propertyType, "Property type", 80);
  if (typeof propertyType === "object") return propertyType;

  const bedrooms = parseNonNegativeInt(raw.bedrooms, "Bedrooms", 50);
  if (typeof bedrooms === "object") return bedrooms;

  const bathrooms = parsePositiveNumber(raw.bathrooms, "Bathrooms");
  if (typeof bathrooms === "object") return bathrooms;

  const neighbourhood = parseOptionalString(raw.neighbourhood, "Neighbourhood", 80);
  if (typeof neighbourhood === "object") return neighbourhood;

  let sqft: number | undefined;
  if (raw.sqft !== undefined && raw.sqft !== null && raw.sqft !== "") {
    const parsedSqft = parsePositiveNumber(raw.sqft, "Square footage");
    if (typeof parsedSqft === "object") return parsedSqft;
    sqft = parsedSqft;
  }

  const parking = parseOptionalString(raw.parking, "Parking", 120);
  if (typeof parking === "object") return parking;

  let furnished: MarketRentFurnished | undefined;
  if (raw.furnished !== undefined && raw.furnished !== null && raw.furnished !== "") {
    if (
      typeof raw.furnished !== "string" ||
      !(MARKET_RENT_FURNISHED_VALUES as readonly string[]).includes(raw.furnished)
    ) {
      return { error: "Furnished must be furnished, unfurnished, or partial" };
    }
    furnished = raw.furnished as MarketRentFurnished;
  }

  const petPolicy = parseOptionalString(raw.petPolicy, "Pet policy", 120);
  if (typeof petPolicy === "object") return petPolicy;

  const notes = parseOptionalString(raw.notes, "Notes", 2000);
  if (typeof notes === "object") return notes;

  const inputs: MarketRentResearchInputs = {
    city,
    propertyType,
    bedrooms,
    bathrooms,
  };

  if (neighbourhood !== undefined) inputs.neighbourhood = neighbourhood;
  if (sqft !== undefined) inputs.sqft = sqft;
  if (parking !== undefined) inputs.parking = parking;
  if (furnished !== undefined) inputs.furnished = furnished;
  if (petPolicy !== undefined) inputs.petPolicy = petPolicy;
  if (notes !== undefined) inputs.notes = notes;

  return inputs;
}
