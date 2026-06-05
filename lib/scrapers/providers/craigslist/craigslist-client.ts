import { ScraperFetchError, ScraperTimeoutError } from "../../errors";
import type { CraigslistSearchParams } from "../../types";
import { mapCraigslistSearchPayload } from "./craigslist-mapper";
import type { RawScraperListing } from "../../types";

export type CraigslistFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 8_000;
const RETRY_BACKOFF_MS = 400;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryCraigslistFetch(error: unknown): boolean {
  if (error instanceof ScraperTimeoutError) return true;
  if (error instanceof ScraperFetchError && error.httpStatus != null && error.httpStatus >= 500) {
    return true;
  }
  return false;
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
        response.status,
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

/** Fetches Craigslist listings with one retry on timeout or HTTP 5xx. */
export async function fetchCraigslistRentalsWithRetry(
  params: CraigslistSearchParams,
  options?: {
    fetchFn?: CraigslistFetchFn;
    timeoutMs?: number;
    cityDisplay?: string;
  },
): Promise<RawScraperListing[]> {
  try {
    return await fetchCraigslistRentals(params, options);
  } catch (error) {
    if (!shouldRetryCraigslistFetch(error)) throw error;
    await sleep(RETRY_BACKOFF_MS);
    return await fetchCraigslistRentals(params, options);
  }
}
