import {
  parseBcPropertyAddress,
  type ParsedBcPropertyAddress,
} from "@/lib/property/parse-bc-address";

/** Stored when CSV/PDF row has no city — schema requires non-empty city. */
export const PORTFOLIO_IMPORT_UNKNOWN_CITY = "Unknown";

/** Stored when CSV/PDF row has no postal code — schema requires non-empty postalCode. */
export const PORTFOLIO_IMPORT_UNKNOWN_POSTAL = "TBD 0T0";

export type ParsedPortfolioPropertyAddress = ParsedBcPropertyAddress & {
  missingPostalCode: boolean;
  missingCity: boolean;
  inferredCity: boolean;
};

const POSTAL_CODE_RE = /\b([A-Za-z]\d[A-Za-z])\s*(\d[A-Za-z]\d)\s*$/;

const KNOWN_CITY_PATTERNS: { pattern: RegExp; city: string }[] = [
  { pattern: /,\s*Maple\s*Ridge\s*$/i, city: "Maple Ridge" },
  { pattern: /,\s*Port\s*Moody\s*$/i, city: "Port Moody" },
  { pattern: /,\s*Port\s*Coquitlam\s*$/i, city: "Port Coquitlam" },
  { pattern: /,\s*West\s*Vancouver\s*$/i, city: "West Vancouver" },
  { pattern: /,\s*Vancouver\s*$/i, city: "Vancouver" },
  { pattern: /,\s*Coquitlam\s*$/i, city: "Coquitlam" },
  { pattern: /,\s*Burnaby\s*$/i, city: "Burnaby" },
  { pattern: /,\s*Belcarra\s*$/i, city: "Belcarra" },
  { pattern: /MapleRidge\s*$/i, city: "Maple Ridge" },
  { pattern: /PortMoody\s*$/i, city: "Port Moody" },
  { pattern: /PortCoquitlam\s*$/i, city: "Port Coquitlam" },
  { pattern: /WestVancouver\s*$/i, city: "West Vancouver" },
  { pattern: /\bBurnaby\s*$/i, city: "Burnaby" },
  { pattern: /\bCoquitlam\s*$/i, city: "Coquitlam" },
  { pattern: /\bBelcarra\s*$/i, city: "Belcarra" },
  { pattern: /\bVancouver\s*$/i, city: "Vancouver" },
];

function normalizePostalCode(part1: string, part2: string): string {
  return `${part1.toUpperCase()} ${part2.toUpperCase()}`;
}

function inferCity(raw: string): { city: string; streetLabel: string; inferred: boolean } | null {
  for (const { pattern, city } of KNOWN_CITY_PATTERNS) {
    const match = raw.match(pattern);
    if (!match) continue;
    const streetLabel = raw.slice(0, match.index).replace(/[,\s]+$/, "").trim();
    if (streetLabel) {
      return { city, streetLabel, inferred: true };
    }
  }
  return null;
}

function splitStreetLines(streetLabel: string): Pick<ParsedBcPropertyAddress, "streetLine1" | "streetLine2"> {
  const segments = streetLabel
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length <= 1) {
    return { streetLine1: streetLabel.trim(), streetLine2: null };
  }
  return {
    streetLine1: segments[0]!,
    streetLine2: segments.slice(1).join(", "),
  };
}

/**
 * Portfolio import address parser — strict BC parse first, then relaxed fallback.
 * Preserves property labels such as Upper/Lower in streetLine1.
 */
export function parsePortfolioPropertyAddress(
  raw: string,
): ParsedPortfolioPropertyAddress | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Property address is required" };
  }

  const strict = parseBcPropertyAddress(trimmed);
  if (!("error" in strict)) {
    return {
      ...strict,
      missingPostalCode: false,
      missingCity: false,
      inferredCity: false,
    };
  }

  const postalMatch = trimmed.match(POSTAL_CODE_RE);
  const postalCode = postalMatch
    ? normalizePostalCode(postalMatch[1]!, postalMatch[2]!)
    : PORTFOLIO_IMPORT_UNKNOWN_POSTAL;
  const withoutPostal = postalMatch
    ? trimmed.slice(0, postalMatch.index).replace(/[,\s]+$/, "").trim()
    : trimmed;

  const commaParts = withoutPostal
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (commaParts.length >= 2) {
    const city = commaParts[commaParts.length - 1]!;
    const streetLabel = commaParts.slice(0, -1).join(", ");
    const { streetLine1, streetLine2 } = splitStreetLines(streetLabel);
    return {
      streetLine1,
      streetLine2,
      city,
      province: "BC",
      postalCode,
      country: "CA",
      missingPostalCode: !postalMatch,
      missingCity: false,
      inferredCity: false,
    };
  }

  const inferred = inferCity(withoutPostal);
  if (inferred) {
    const { streetLine1, streetLine2 } = splitStreetLines(inferred.streetLabel);
    return {
      streetLine1,
      streetLine2,
      city: inferred.city,
      province: "BC",
      postalCode,
      country: "CA",
      missingPostalCode: !postalMatch,
      missingCity: false,
      inferredCity: inferred.inferred,
    };
  }

  const { streetLine1, streetLine2 } = splitStreetLines(withoutPostal);
  if (!streetLine1) {
    return { error: "Property address must include a street or property label" };
  }

  return {
    streetLine1,
    streetLine2,
    city: PORTFOLIO_IMPORT_UNKNOWN_CITY,
    province: "BC",
    postalCode,
    country: "CA",
    missingPostalCode: !postalMatch,
    missingCity: true,
    inferredCity: false,
  };
}

export function portfolioPropertyImportDedupKey(address: ParsedPortfolioPropertyAddress): string {
  const street = address.streetLine1.trim().toLowerCase().replace(/\s+/g, " ");
  const city = address.city.trim().toLowerCase().replace(/\s+/g, " ");
  const postal = address.postalCode.trim().toLowerCase().replace(/\s+/g, "");
  const line2 = (address.streetLine2 ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return [street, city, postal, line2].join("|");
}

export function isPortfolioImportUnknownCity(city: string): boolean {
  return city.trim() === PORTFOLIO_IMPORT_UNKNOWN_CITY;
}

export function isPortfolioImportUnknownPostal(postalCode: string): boolean {
  return postalCode.trim().toUpperCase() === PORTFOLIO_IMPORT_UNKNOWN_POSTAL;
}
