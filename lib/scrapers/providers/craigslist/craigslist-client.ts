import { ScraperFetchError, ScraperTimeoutError } from "../../errors";
import type { CraigslistSearchParams } from "../../types";
import { mapCraigslistSearchPayload } from "./craigslist-mapper";
import type { RawScraperListing } from "../../types";

export type CraigslistFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 8_000;
const SEARCH_API = "https://sapi.craigslist.org/web/v8/postings/search/full";

function buildSearchUrl(params: CraigslistSearchParams): string {
  const searchParams = new URLSearchParams({
    searchPath: "apa",
    query: params.query,
    cc: "CA",
    lang: "en",
    batch: "0-360-0-0-0-0-0-0-0-0",
  });
  return `${SEARCH_API}?${searchParams.toString()}`;
}

export async function fetchCraigslistSearchPayload(
  params: CraigslistSearchParams,
  options?: {
    fetchFn?: CraigslistFetchFn;
    timeoutMs?: number;
    cityDisplay?: string;
  },
): Promise<unknown> {
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = buildSearchUrl(params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "RocketPM-MarketRentResearch/1.0 (staff-internal)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ScraperFetchError(
        "craigslist",
        `Craigslist search failed (${response.status}).`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ScraperFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ScraperTimeoutError();
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new ScraperFetchError("craigslist", message);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCraigslistRentals(
  params: CraigslistSearchParams,
  options?: {
    fetchFn?: CraigslistFetchFn;
    timeoutMs?: number;
    cityDisplay?: string;
  },
): Promise<RawScraperListing[]> {
  const payload = await fetchCraigslistSearchPayload(params, options);
  const city = options?.cityDisplay ?? params.citySlug;
  return mapCraigslistSearchPayload(payload, city);
}
