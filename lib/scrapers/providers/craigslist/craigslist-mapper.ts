import type { RawScraperListing } from "../../types";

/** Legacy fixture / test payload item shape. */
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

/** Live Craigslist SAPI v8 item shape. */
export type CraigslistSapiItem = {
  postingId: number | string;
  title: string;
  price?: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  seo?: string;
  categoryAbbr?: string;
  postedDate?: number;
  location?: {
    hostname?: string;
    subareaAbbr?: string;
    description?: string;
  };
};

export type CraigslistSearchPayload = {
  data?: {
    items?: Array<CraigslistFixtureItem | CraigslistSapiItem | Record<string, unknown>>;
    totalResultCount?: number;
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

function isFixtureItem(item: Record<string, unknown>): item is CraigslistFixtureItem {
  return typeof item.url === "string" && typeof item.price === "number";
}

export function buildCraigslistListingUrl(item: CraigslistSapiItem): string {
  const loc = item.location ?? {};
  const hostname = loc.hostname?.trim();
  const postingId = item.postingId;
  if (!hostname || postingId == null || postingId === "") return "";

  const parts = [
    loc.subareaAbbr?.trim(),
    item.categoryAbbr?.trim() || "apa",
    "d",
    item.seo?.trim(),
    String(postingId),
  ].filter(Boolean);

  return `https://${hostname}.craigslist.org/${parts.join("/")}.html`;
}

function postedAtFromUnixSeconds(postedDate: number | undefined): string | null {
  if (postedDate == null || !Number.isFinite(postedDate)) return null;
  return new Date(postedDate * 1000).toISOString();
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

function mapSapiItem(
  item: CraigslistSapiItem,
  city: string,
  capturedAt: string,
): RawScraperListing | null {
  const monthlyRent = Number(item.price);
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return null;

  const title = item.title?.trim();
  if (!title) return null;

  const sourceUrl = buildCraigslistListingUrl(item);
  if (!sourceUrl) return null;

  const neighbourhood = item.location?.description?.trim() || null;

  return {
    source: "craigslist",
    sourceListingId: String(item.postingId),
    sourceUrl,
    title,
    monthlyRent,
    bedrooms: item.bedrooms ?? parseBedroomsFromTitle(title),
    bathrooms: item.bathrooms ?? parseBathroomsFromTitle(title),
    sqft: item.sqft ?? parseSqftFromTitle(title),
    city,
    neighbourhood,
    postedAt: postedAtFromUnixSeconds(item.postedDate),
    capturedAt,
    propertyTypeHint: parsePropertyTypeFromTitle(title),
  };
}

function mapSearchItem(
  item: Record<string, unknown>,
  city: string,
  capturedAt: string,
): RawScraperListing | null {
  if (isFixtureItem(item)) {
    return mapFixtureItem(item, city, capturedAt);
  }
  return mapSapiItem(item as CraigslistSapiItem, city, capturedAt);
}

/** Maps Craigslist search API payload to raw listing summaries. */
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
    const mapped = mapSearchItem(item as Record<string, unknown>, city, capturedAt);
    if (mapped) listings.push(mapped);
  }
  return listings;
}

export function getCraigslistSearchTotalCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const total = (payload as CraigslistSearchPayload).data?.totalResultCount;
  return typeof total === "number" ? total : null;
}
