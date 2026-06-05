import { craigslistSearchPageUrl } from "./craigslist-hostname";

export type CraigslistPageFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const AREA_ID_RE = /"areaId"\s*:\s*(\d+)/;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type AreaIdCacheEntry = {
  areaId: number;
  expiresAt: number;
};

const areaIdCache = new Map<string, AreaIdCacheEntry>();

export function extractAreaIdFromHtml(html: string): number | null {
  const match = AREA_ID_RE.exec(html);
  if (!match) return null;
  const areaId = Number(match[1]);
  return Number.isInteger(areaId) && areaId > 0 ? areaId : null;
}

export function getCachedCraigslistAreaId(hostname: string): number | null {
  const entry = areaIdCache.get(hostname);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    areaIdCache.delete(hostname);
    return null;
  }
  return entry.areaId;
}

export function cacheCraigslistAreaId(
  hostname: string,
  areaId: number,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  areaIdCache.set(hostname, { areaId, expiresAt: Date.now() + ttlMs });
}

export function clearCraigslistAreaIdCache(): void {
  areaIdCache.clear();
}

export async function resolveCraigslistAreaId(
  hostname: string,
  options?: {
    fetchFn?: CraigslistPageFetchFn;
    ttlMs?: number;
  },
): Promise<number> {
  const cached = getCachedCraigslistAreaId(hostname);
  if (cached != null) return cached;

  const fetchFn = options?.fetchFn ?? fetch;
  const pageUrl = craigslistSearchPageUrl(hostname);
  const response = await fetchFn(pageUrl, {
    method: "GET",
    headers: {
      Accept: "text/html",
      "User-Agent": "RocketPM-MarketRentResearch/1.0 (staff-internal)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to resolve Craigslist area_id for ${hostname} (HTTP ${response.status}).`,
    );
  }

  const html = await response.text();
  const areaId = extractAreaIdFromHtml(html);
  if (areaId == null) {
    throw new Error(`Craigslist area_id not found in search page for ${hostname}.`);
  }

  cacheCraigslistAreaId(hostname, areaId, options?.ttlMs);
  return areaId;
}
