export type ParsedBcPropertyAddress = {
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

const POSTAL_CODE_RE = /\b([A-Za-z]\d[A-Za-z])\s*(\d[A-Za-z]\d)\s*$/;
const PROVINCE_TOKEN_RE = /^(BC|British Columbia)$/i;

function normalizePostalCode(part1: string, part2: string): string {
  return `${part1.toUpperCase()} ${part2.toUpperCase()}`;
}

/**
 * Parses a single-line BC property address into Rocket PM property fields.
 * Expected shapes: "123 Main St, Vancouver, BC V6B 1A1" or similar.
 */
export function parseBcPropertyAddress(
  raw: string,
): ParsedBcPropertyAddress | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Property address is required" };
  }

  const postalMatch = trimmed.match(POSTAL_CODE_RE);
  if (!postalMatch) {
    return { error: "Property address must include a Canadian postal code" };
  }

  const postalCode = normalizePostalCode(postalMatch[1], postalMatch[2]);
  const beforePostal = trimmed.slice(0, postalMatch.index).replace(/[,\s]+$/, "");
  if (!beforePostal) {
    return { error: "Property address must include a street and city" };
  }

  const segments = beforePostal
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return { error: "Property address must include street and city separated by commas" };
  }

  const provinceSegment = segments[segments.length - 1];
  const citySegment = segments[segments.length - 2];
  const streetSegments = segments.slice(0, -2);

  if (!PROVINCE_TOKEN_RE.test(provinceSegment)) {
    return { error: "Property address must include BC or British Columbia before the postal code" };
  }

  if (streetSegments.length === 0) {
    return { error: "Property address must include a street line" };
  }

  const streetLine1 = streetSegments[0];
  const streetLine2 = streetSegments.length > 1 ? streetSegments.slice(1).join(", ") : null;

  if (!streetLine1 || !citySegment) {
    return { error: "Property address must include a street and city" };
  }

  return {
    streetLine1,
    streetLine2,
    city: citySegment,
    province: "BC",
    postalCode,
    country: "CA",
  };
}

export function propertyImportDedupKey(streetLine1: string, postalCode: string): string {
  const street = streetLine1.trim().toLowerCase().replace(/\s+/g, " ");
  const postal = postalCode.trim().toLowerCase().replace(/\s+/g, "");
  return `${street}|${postal}`;
}
