import { ScraperFetchError, ScraperTimeoutError, type ScraperFetchDiagnostics } from "../../errors";
import type { CraigslistSearchParams, ProviderRequestDiagnostics } from "../../types";
import { resolveCraigslistAreaId } from "./craigslist-area-id";
import { mapCraigslistSearchPayload } from "./craigslist-mapper";
import type { RawScraperListing } from "../../types";

export type CraigslistFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 8_000;
const RETRY_BACKOFF_MS = 400;
const RESPONSE_BODY_SNIPPET_MAX = 500;
export const CRAIGSLIST_SEARCH_API = "https://sapi.craigslist.org/web/v8/postings/search";

const SAPI_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "RocketPM-MarketRentResearch/1.0 (staff-internal)",
};

let lastProviderDiagnostics: ProviderRequestDiagnostics | null = null;

export function getLastCraigslistProviderDiagnostics(): ProviderRequestDiagnostics | null {
  return lastProviderDiagnostics;
}

export function clearLastCraigslistProviderDiagnostics(): void {
  lastProviderDiagnostics = null;
}

function truncateResponseBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= RESPONSE_BODY_SNIPPET_MAX) return trimmed;
  return `${trimmed.slice(0, RESPONSE_BODY_SNIPPET_MAX)}…`;
}

export function buildCraigslistSearchUrl(
  params: CraigslistSearchParams,
  areaId: number,
): string {
  const searchParams = new URLSearchParams({
    area_id: String(areaId),
    lang: "en",
    searchPath: "apa",
    query: params.query,
  });

  const minBedrooms = params.minBedrooms ?? Math.max(0, params.bedrooms - 1);
  const maxBedrooms = params.maxBedrooms ?? params.bedrooms + 1;
  searchParams.set("min_bedrooms", String(minBedrooms));
  searchParams.set("max_bedrooms", String(maxBedrooms));

  if (params.minPrice != null && params.minPrice > 0) {
    searchParams.set("min_price", String(Math.round(params.minPrice)));
  }
  if (params.maxPrice != null && params.maxPrice > 0) {
    searchParams.set("max_price", String(Math.round(params.maxPrice)));
  }

  return `${CRAIGSLIST_SEARCH_API}?${searchParams.toString()}`;
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

function recordDiagnostics(diagnostics: ProviderRequestDiagnostics): void {
  lastProviderDiagnostics = diagnostics;
}

function logCraigslistFailure(diagnostics: ScraperFetchDiagnostics): void {
  console.warn("[market-rent-research] craigslist fetch failed", diagnostics);
}

async function resolveAreaIdForParams(
  params: CraigslistSearchParams,
  fetchFn: CraigslistFetchFn,
): Promise<number> {
  if (params.areaId != null && params.areaId > 0) {
    return params.areaId;
  }
  return resolveCraigslistAreaId(params.citySlug, { fetchFn });
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
  const started = Date.now();

  let url = "";
  try {
    const areaId = await resolveAreaIdForParams(params, fetchFn);
    url = buildCraigslistSearchUrl(params, areaId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, {
        method: "GET",
        headers: SAPI_HEADERS,
        signal: controller.signal,
      });

      const elapsedMs = Date.now() - started;
      const responseText = await response.text();

      if (!response.ok) {
        const diagnostics: ScraperFetchDiagnostics = {
          requestUrl: url,
          httpStatus: response.status,
          responseBodySnippet: truncateResponseBody(responseText),
          elapsedMs,
        };
        recordDiagnostics({
          source: "craigslist",
          ...diagnostics,
          success: false,
        });
        logCraigslistFailure(diagnostics);
        throw new ScraperFetchError(
          "craigslist",
          `Craigslist search failed (${response.status}).`,
          response.status,
          diagnostics,
        );
      }

      recordDiagnostics({
        source: "craigslist",
        requestUrl: url,
        httpStatus: response.status,
        elapsedMs,
        success: true,
      });

      try {
        return JSON.parse(responseText) as unknown;
      } catch {
        const diagnostics: ScraperFetchDiagnostics = {
          requestUrl: url,
          httpStatus: response.status,
          responseBodySnippet: truncateResponseBody(responseText),
          elapsedMs,
        };
        recordDiagnostics({
          source: "craigslist",
          ...diagnostics,
          success: false,
        });
        logCraigslistFailure(diagnostics);
        throw new ScraperFetchError(
          "craigslist",
          "Craigslist returned a non-JSON response.",
          response.status,
          diagnostics,
        );
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof ScraperFetchError) throw error;

    const elapsedMs = Date.now() - started;
    if (error instanceof Error && error.name === "AbortError") {
      const diagnostics: ScraperFetchDiagnostics = {
        requestUrl: url || "(unresolved)",
        elapsedMs,
      };
      recordDiagnostics({
        source: "craigslist",
        ...diagnostics,
        success: false,
      });
      logCraigslistFailure(diagnostics);
      throw new ScraperTimeoutError();
    }

    const message = error instanceof Error ? error.message : String(error);
    const diagnostics: ScraperFetchDiagnostics = {
      requestUrl: url || "(unresolved)",
      elapsedMs,
      responseBodySnippet: message.slice(0, RESPONSE_BODY_SNIPPET_MAX),
    };
    recordDiagnostics({
      source: "craigslist",
      ...diagnostics,
      success: false,
    });
    logCraigslistFailure(diagnostics);
    throw new ScraperFetchError("craigslist", message, undefined, diagnostics);
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
