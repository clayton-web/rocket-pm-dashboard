import { PROPERTY_PROFILE_TYPES } from "@/lib/property/profile";

export type PropertyProfileFormInput = {
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  approxSqft: number | null;
};

function parseOptionalPropertyType(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: "Invalid property type" };
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!(PROPERTY_PROFILE_TYPES as readonly string[]).includes(normalized)) {
    return { error: "Property type must be detached, condo, or townhouse" };
  }
  return normalized;
}

function parseOptionalBedrooms(value: unknown): number | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 50) {
    return { error: "Bedrooms must be a whole number between 0 and 50" };
  }
  return n;
}

function parseOptionalBathrooms(value: unknown): number | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 20) {
    return { error: "Bathrooms must be a positive number up to 20" };
  }
  if (Math.round(n * 2) / 2 !== n) {
    return { error: "Bathrooms must use 0.5 increments" };
  }
  return n;
}

function parseOptionalApproxSqft(value: unknown): number | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 50_000) {
    return { error: "Approx. sqft must be a whole number between 1 and 50000" };
  }
  return n;
}

export function parsePropertyProfileFormInput(
  body: unknown,
): PropertyProfileFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;

  const propertyType = parseOptionalPropertyType(raw.propertyType);
  if (propertyType !== null && typeof propertyType === "object") return propertyType;

  const bedrooms = parseOptionalBedrooms(raw.bedrooms);
  if (bedrooms !== null && typeof bedrooms === "object") return bedrooms;

  const bathrooms = parseOptionalBathrooms(raw.bathrooms);
  if (bathrooms !== null && typeof bathrooms === "object") return bathrooms;

  const approxSqft = parseOptionalApproxSqft(raw.approxSqft);
  if (approxSqft !== null && typeof approxSqft === "object") return approxSqft;

  return { propertyType, bedrooms, bathrooms, approxSqft };
}
