import type { RawScraperListing } from "../../types";

export type CraigslistFixtureItem = {
  postingId: string;
  url: string;
  title: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  neighbourhood?: string | null;
  postedAt?: string | null;
  propertyTypeHint?: string | null;
};

export type CraigslistSearchPayload = {
  data?: {
    items?: CraigslistFixtureItem[];
  };
};

function parseBedroomsFromTitle(title: string): number | null {
  const match = title.match(/(\d+)\s*(?:br|bed|bedroom)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parseBathroomsFromTitle(title: string): number | null {
  const match = title.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|bathroom)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parseSqftFromTitle(title: string): number | null {
  const match = title.match(/(\d{3,4})\s*(?:sq\.?\s*ft|sqft|sf)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parsePropertyTypeFromTitle(title: string): string | null {
  const lower = title.toLowerCase();
  if (/\bcondo\b|\bapartment\b|\bapt\b/.test(lower)) return "condo";
  if (/\bhouse\b|\bduplex\b|\btownhouse\b/.test(lower)) return "house";
  if (/\bbasement\b|\bsuite\b/.test(lower)) return "basement suite";
  return null;
}

function mapFixtureItem(
  item: CraigslistFixtureItem,
  city: string,
  capturedAt: string,
): RawScraperListing | null {
  const monthlyRent = Number(item.price);
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return null;

  const title = item.title.trim();
  if (!title) return null;

  return {
    source: "craigslist",
    sourceListingId: String(item.postingId),
    sourceUrl: item.url,
    title,
    monthlyRent,
    bedrooms: item.bedrooms ?? parseBedroomsFromTitle(title),
    bathrooms: item.bathrooms ?? parseBathroomsFromTitle(title),
    sqft: item.sqft ?? parseSqftFromTitle(title),
    city,
    neighbourhood: item.neighbourhood?.trim() || null,
    postedAt: item.postedAt ?? null,
    capturedAt,
    propertyTypeHint: item.propertyTypeHint ?? parsePropertyTypeFromTitle(title),
  };
}

/** Maps Craigslist search API payload to raw listing summaries (fixture-friendly). */
export function mapCraigslistSearchPayload(
  payload: unknown,
  city: string,
  capturedAt: string = new Date().toISOString(),
): RawScraperListing[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as CraigslistSearchPayload).data;
  if (!data?.items || !Array.isArray(data.items)) return [];

  const listings: RawScraperListing[] = [];
  for (const item of data.items) {
    if (!item || typeof item !== "object") continue;
    const mapped = mapFixtureItem(item, city, capturedAt);
    if (mapped) listings.push(mapped);
  }
  return listings;
}
