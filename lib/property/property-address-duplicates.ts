import {
  normalizeStreetLineKey,
  normalizeUnitKey,
} from "@/lib/integrations/pm-context/normalize-address-hint";
import { isPortfolioImportUnknownPostal } from "@/lib/portfolio/parse-portfolio-address";
import { normalizePostalSearchKey, normalizeSearchText } from "@/lib/property/portfolio-health-search";

/**
 * Soft duplicate-address detection for the manual property-address editor.
 *
 * This is advisory only. It never blocks a save, and it deliberately stays quiet on the shapes
 * that are legitimately duplicated in a BC portfolio — duplexes, suites, laneway homes and any
 * property sharing a civic address but carrying its own secondary designator. `streetLine1` alone
 * is not treated as identity, because in this portfolio it frequently is not.
 *
 * Street comparison reuses `normalizeStreetLineKey`, the same canonicalization the committed
 * PM-context resolver uses to match inbound address hints. Sharing it means a warning here
 * predicts a real collision there, rather than approximating it with a second-guess normalizer.
 */

export type PropertyAddressIdentity = {
  propertyId: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  postalCode: string;
};

/**
 * `likely` — same civic address, same city, and no secondary designator distinguishing them.
 * `possible` — same civic address and city, but only one side carries a secondary designator,
 * so this may be a whole-property record sitting alongside one of its suites.
 */
export type PropertyAddressDuplicateConfidence = "likely" | "possible";

export type PropertyAddressDuplicateMatch = {
  propertyId: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  postalCode: string;
  confidence: PropertyAddressDuplicateConfidence;
  /** True when the two records disagree on postal code for the same civic address. */
  postalCodeMismatch: boolean;
};

function cityKey(value: string): string {
  return normalizeSearchText(value);
}

function secondaryKey(value: string | null): string {
  if (!value) return "";
  return normalizeUnitKey(value);
}

function postalKey(value: string): string {
  if (!value || isPortfolioImportUnknownPostal(value)) return "";
  return normalizePostalSearchKey(value);
}

function compare(
  candidate: PropertyAddressIdentity,
  other: PropertyAddressIdentity,
): PropertyAddressDuplicateMatch | null {
  const candidateStreet = normalizeStreetLineKey(candidate.streetLine1);
  if (!candidateStreet) return null;
  if (normalizeStreetLineKey(other.streetLine1) !== candidateStreet) return null;

  // The same street name in a different municipality is a different address, not a duplicate.
  const candidateCity = cityKey(candidate.city);
  if (!candidateCity || cityKey(other.city) !== candidateCity) return null;

  const candidateSecondary = secondaryKey(candidate.streetLine2);
  const otherSecondary = secondaryKey(other.streetLine2);

  // Both sides name a unit and the units differ: this is a duplex or suite, not a collision.
  if (candidateSecondary && otherSecondary && candidateSecondary !== otherSecondary) {
    return null;
  }

  const candidatePostal = postalKey(candidate.postalCode);
  const otherPostal = postalKey(other.postalCode);

  return {
    propertyId: other.propertyId,
    streetLine1: other.streetLine1,
    streetLine2: other.streetLine2,
    city: other.city,
    postalCode: other.postalCode,
    confidence: candidateSecondary === otherSecondary ? "likely" : "possible",
    postalCodeMismatch: Boolean(
      candidatePostal && otherPostal && candidatePostal !== otherPostal,
    ),
  };
}

/**
 * Returns advisory matches for `candidate` within an already organization-scoped list.
 *
 * Callers are responsible for passing only same-organization rows; cross-organization data never
 * reaches this function, so a shared street address in another organization cannot warn.
 */
export function findLikelyDuplicateAddresses(
  candidate: PropertyAddressIdentity,
  existing: readonly PropertyAddressIdentity[],
): PropertyAddressDuplicateMatch[] {
  const matches: PropertyAddressDuplicateMatch[] = [];

  for (const other of existing) {
    if (other.propertyId === candidate.propertyId) continue;
    const match = compare(candidate, other);
    if (match) matches.push(match);
  }

  return matches.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "likely" ? -1 : 1;
    return a.propertyId.localeCompare(b.propertyId);
  });
}

export const PROPERTY_ADDRESS_DUPLICATE_WARNING =
  "Another property may already use this address.";
