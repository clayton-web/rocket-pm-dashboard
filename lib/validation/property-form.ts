import { parsePropertyProfileFormInput } from "./property-profile";

export type CreatePropertyFormInput = {
  name: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  approxSqft: number | null;
};

export type CreateUnitFormInput = {
  unitNumber: string;
  floor: string | null;
  bedrooms: number | null;
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
): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return { error: `${field} is too long` };
  return trimmed;
}

export function parseCreatePropertyFormInput(
  body: unknown,
): CreatePropertyFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;

  const streetLine1 = parseRequiredString(raw.streetLine1, "Street address", 300);
  if (typeof streetLine1 === "object") return streetLine1;

  const streetLine2 = parseOptionalString(raw.streetLine2, "Street line 2", 300);
  if (streetLine2 !== null && typeof streetLine2 === "object") return streetLine2;

  const city = parseRequiredString(raw.city, "City", 120);
  if (typeof city === "object") return city;

  const provinceRaw =
    raw.province === undefined || raw.province === null || raw.province === ""
      ? "BC"
      : raw.province;
  const province = parseRequiredString(provinceRaw, "Province", 20);
  if (typeof province === "object") return province;

  const postalCode = parseRequiredString(raw.postalCode, "Postal code", 20);
  if (typeof postalCode === "object") return postalCode;

  const profile = parsePropertyProfileFormInput({
    propertyType: raw.propertyType,
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    approxSqft: raw.approxSqft,
  });
  if ("error" in profile) return profile;

  return {
    name: streetLine1,
    streetLine1,
    streetLine2,
    city,
    province,
    postalCode,
    propertyType: profile.propertyType,
    bedrooms: profile.bedrooms,
    bathrooms: profile.bathrooms,
    approxSqft: profile.approxSqft,
  };
}

export function parseCreateUnitFormInput(body: unknown): CreateUnitFormInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;

  const unitNumber = parseRequiredString(raw.unitNumber, "Unit number", 50);
  if (typeof unitNumber === "object") return unitNumber;

  const floor = parseOptionalString(raw.floor, "Floor", 50);
  if (floor !== null && typeof floor === "object") return floor;

  let bedrooms: number | null = null;
  if (raw.bedrooms !== undefined && raw.bedrooms !== null && raw.bedrooms !== "") {
    const n = typeof raw.bedrooms === "number" ? raw.bedrooms : Number(raw.bedrooms);
    if (!Number.isInteger(n) || n < 0 || n > 50) {
      return { error: "Bedrooms must be a whole number between 0 and 50" };
    }
    bedrooms = n;
  }

  return { unitNumber, floor, bedrooms };
}
