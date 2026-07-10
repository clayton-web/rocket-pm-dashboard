import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import {
  parseTenancyDateField,
  parseTenancyMoneyField,
} from "@/lib/validation/tenancy-fields";

export type RentalListingFormFields = {
  monthlyRent: number | null;
  availableDate: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  approxSqft: number | null;
  headline: string | null;
  description: string | null;
  petPolicy: string | null;
  parkingDetails: string | null;
  utilitiesDetails: string | null;
  viewingInstructions: string | null;
};

function isValidationError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
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

function parseOptionalMonthlyRent(value: unknown): number | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parseTenancyMoneyField(value, "Monthly rent", true);
  if (isValidationError(parsed)) return parsed;
  if (parsed === undefined) return null;
  if (parsed <= 0) return { error: "Monthly rent must be greater than zero" };
  return parsed;
}

function parseOptionalAvailableDate(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parseTenancyDateField(value, "Available date", true);
  if (isValidationError(parsed)) return parsed;
  return parsed ?? null;
}

/** Parse listing editor fields. Drafts may omit rent/date; publish validates separately. */
export function parseRentalListingFormInput(
  body: unknown,
): RentalListingFormFields | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid form data" };
  }
  const raw = body as Record<string, unknown>;

  const monthlyRent = parseOptionalMonthlyRent(raw.monthlyRent);
  if (isValidationError(monthlyRent)) return monthlyRent;

  const availableDate = parseOptionalAvailableDate(raw.availableDate);
  if (isValidationError(availableDate)) return availableDate;

  const bedrooms = parseOptionalBedrooms(raw.bedrooms);
  if (isValidationError(bedrooms)) return bedrooms;

  const bathrooms = parseOptionalBathrooms(raw.bathrooms);
  if (isValidationError(bathrooms)) return bathrooms;

  const approxSqft = parseOptionalApproxSqft(raw.approxSqft);
  if (isValidationError(approxSqft)) return approxSqft;

  const headline = parseOptionalString(raw.headline, "Headline", 200);
  if (isValidationError(headline)) return headline;

  const description = parseOptionalString(raw.description, "Description", 8000);
  if (isValidationError(description)) return description;

  const petPolicy = parseOptionalString(raw.petPolicy, "Pet policy", 2000);
  if (isValidationError(petPolicy)) return petPolicy;

  const parkingDetails = parseOptionalString(raw.parkingDetails, "Parking details", 2000);
  if (isValidationError(parkingDetails)) return parkingDetails;

  const utilitiesDetails = parseOptionalString(raw.utilitiesDetails, "Utilities details", 2000);
  if (isValidationError(utilitiesDetails)) return utilitiesDetails;

  const viewingInstructions = parseOptionalString(
    raw.viewingInstructions,
    "Viewing instructions",
    2000,
  );
  if (isValidationError(viewingInstructions)) return viewingInstructions;

  return {
    monthlyRent,
    availableDate,
    bedrooms,
    bathrooms,
    approxSqft,
    headline,
    description,
    petPolicy,
    parkingDetails,
    utilitiesDetails,
    viewingInstructions,
  };
}

export function rentalListingFormDatesToServiceInput(fields: RentalListingFormFields): {
  monthlyRent: number | null;
  availableDate: Date | null;
  bedrooms: number | null;
  bathrooms: number | null;
  approxSqft: number | null;
  headline: string | null;
  description: string | null;
  petPolicy: string | null;
  parkingDetails: string | null;
  utilitiesDetails: string | null;
  viewingInstructions: string | null;
} {
  return {
    monthlyRent: fields.monthlyRent,
    availableDate: fields.availableDate ? toDateOnlyUTC(fields.availableDate) : null,
    bedrooms: fields.bedrooms,
    bathrooms: fields.bathrooms,
    approxSqft: fields.approxSqft,
    headline: fields.headline,
    description: fields.description,
    petPolicy: fields.petPolicy,
    parkingDetails: fields.parkingDetails,
    utilitiesDetails: fields.utilitiesDetails,
    viewingInstructions: fields.viewingInstructions,
  };
}
