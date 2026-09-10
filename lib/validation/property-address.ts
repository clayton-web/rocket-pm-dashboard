import {
  isPortfolioImportUnknownCity,
  isPortfolioImportUnknownPostal,
  PORTFOLIO_IMPORT_UNKNOWN_CITY,
  PORTFOLIO_IMPORT_UNKNOWN_POSTAL,
} from "@/lib/portfolio/parse-portfolio-address";

/**
 * Hand-written parser for the manual property-address editor, matching the shape and error style
 * of `property-form.ts` and `property-owner-strata.ts`. Zod is in the dependency tree but is used
 * only for AI output schemas; no property editor uses it.
 */

export type PropertyAddressFormInput = {
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

/** Canadian provinces and territories. Long forms the repository already recognises map to codes. */
export const PROPERTY_PROVINCE_CODES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;

const PROVINCE_LONG_FORMS: Record<string, string> = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "nova scotia": "NS",
  "northwest territories": "NT",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  québec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
};

export const DEFAULT_PROPERTY_PROVINCE = "BC";
export const DEFAULT_PROPERTY_COUNTRY = "CA";

const CANADIAN_POSTAL_RE = /^([A-Za-z]\d[A-Za-z])[\s-]*(\d[A-Za-z]\d)$/;

/**
 * Collapses runs of whitespace without touching anything else.
 *
 * Import parsers and the PM-context dedup keys already normalize this way, so a street line typed
 * with a double space compares equal to the same line typed with one.
 */
function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseRequiredString(
  value: unknown,
  field: string,
  maxLen: number,
): string | { error: string } {
  if (typeof value !== "string") return { error: `${field} is required` };
  const collapsed = collapseWhitespace(value);
  if (!collapsed) return { error: `${field} is required` };
  if (collapsed.length > maxLen) return { error: `${field} is too long` };
  return collapsed;
}

function parseOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: `Invalid ${field}` };
  const collapsed = collapseWhitespace(value);
  if (!collapsed) return null;
  if (collapsed.length > maxLen) return { error: `${field} is too long` };
  return collapsed;
}

/**
 * Normalizes to `A1A 1A1`, reusing the format the import parsers store.
 *
 * The import placeholder is rejected explicitly: Property Health flags `TBD 0T0` as
 * `missing_postal_code`, so accepting it here would let staff "fix" a row that immediately
 * reappears in the cleanup queue.
 */
export function normalizeCanadianPostalCode(value: string): string | { error: string } {
  const collapsed = collapseWhitespace(value).toUpperCase();
  if (!collapsed) return { error: "Postal code is required" };
  if (isPortfolioImportUnknownPostal(collapsed)) {
    return {
      error: `Postal code cannot be left as the import placeholder "${PORTFOLIO_IMPORT_UNKNOWN_POSTAL}"`,
    };
  }

  const match = collapsed.match(CANADIAN_POSTAL_RE);
  if (!match) {
    return { error: "Postal code must be a Canadian postal code such as V6B 1A1" };
  }
  return `${match[1]} ${match[2]}`;
}

export function normalizePropertyProvince(value: unknown): string | { error: string } {
  if (value === undefined || value === null || value === "") return DEFAULT_PROPERTY_PROVINCE;
  if (typeof value !== "string") return { error: "Invalid province" };

  const collapsed = collapseWhitespace(value);
  if (!collapsed) return DEFAULT_PROPERTY_PROVINCE;

  const long = PROVINCE_LONG_FORMS[collapsed.toLowerCase()];
  const candidate = long ?? collapsed.toUpperCase();
  if (!(PROPERTY_PROVINCE_CODES as readonly string[]).includes(candidate)) {
    return { error: "Province must be a Canadian province or territory code such as BC" };
  }
  return candidate;
}

/**
 * Country is written on every save so the record is explicit, but the only value the schema,
 * postal validation, and address parsers support today is Canada. Rejecting anything else is
 * deliberate: silently storing `US` would leave a row whose postal code can never validate.
 */
export function normalizePropertyCountry(value: unknown): string | { error: string } {
  if (value === undefined || value === null || value === "") return DEFAULT_PROPERTY_COUNTRY;
  if (typeof value !== "string") return { error: "Invalid country" };

  const collapsed = collapseWhitespace(value);
  if (!collapsed) return DEFAULT_PROPERTY_COUNTRY;

  const candidate = collapsed.toUpperCase();
  if (candidate === "CANADA") return DEFAULT_PROPERTY_COUNTRY;
  if (candidate !== DEFAULT_PROPERTY_COUNTRY) {
    return { error: "Country must be CA — only Canadian addresses are supported" };
  }
  return DEFAULT_PROPERTY_COUNTRY;
}

export function parsePropertyAddressFormInput(
  body: unknown,
): PropertyAddressFormInput | { error: string } {
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
  if (isPortfolioImportUnknownCity(city)) {
    return { error: `City cannot be left as the import placeholder "${PORTFOLIO_IMPORT_UNKNOWN_CITY}"` };
  }

  const province = normalizePropertyProvince(raw.province);
  if (typeof province === "object") return province;

  const postalCode = normalizeCanadianPostalCode(
    typeof raw.postalCode === "string" ? raw.postalCode : "",
  );
  if (typeof postalCode === "object") return postalCode;

  const country = normalizePropertyCountry(raw.country);
  if (typeof country === "object") return country;

  return { streetLine1, streetLine2, city, province, postalCode, country };
}

/** The subset of an address the duplicate comparison reads. */
export type PropertyAddressDuplicateQuery = {
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  postalCode: string;
};

/**
 * Lenient counterpart to `parsePropertyAddressFormInput`, for the advisory duplicate lookup.
 *
 * The duplicate warning must work on exactly the addresses the save parser rejects: a property
 * still carrying `Unknown` / `TBD 0T0` from the portfolio import is the one most likely to be a
 * duplicate, and it is also the one staff are mid-way through repairing. Reusing the strict parser
 * here would blank the warning for the entire cleanup population, and again on every keystroke of
 * a half-typed postal code.
 *
 * Returns null when there is nothing worth comparing, which is the only "failure" this path has.
 */
export function parsePropertyAddressDuplicateQuery(
  body: unknown,
): PropertyAddressDuplicateQuery | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;

  const text = (value: unknown): string =>
    typeof value === "string" ? collapseWhitespace(value).slice(0, 300) : "";

  const streetLine1 = text(raw.streetLine1);
  if (!streetLine1) return null;

  const streetLine2 = text(raw.streetLine2);
  return {
    streetLine1,
    streetLine2: streetLine2 || null,
    city: text(raw.city),
    postalCode: text(raw.postalCode).toUpperCase(),
  };
}
