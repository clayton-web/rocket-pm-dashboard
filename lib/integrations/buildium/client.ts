import type { BuildiumEnvironment } from "@prisma/client";
import {
  BUILDIUM_REQUEST_TIMEOUT_MS,
  BUILDIUM_RETRY_INITIAL_MS,
  BUILDIUM_MAX_RETRIES,
  isBuildiumReadOnlyMode,
  resolveBuildiumBaseUrl,
} from "@/lib/integrations/buildium/config";
import {
  BuildiumApiError,
  isRetryableBuildiumError,
  mapHttpStatusToBuildiumError,
} from "@/lib/integrations/buildium/errors";
import type { BuildiumCredentials, BuildiumFetchResult } from "@/lib/integrations/buildium/types";
import { parseTotalCountHeader } from "@/lib/integrations/buildium/pagination";

export type BuildiumFetchFn = typeof fetch;

export type BuildiumClientOptions = {
  environment: BuildiumEnvironment;
  credentials: BuildiumCredentials;
  fetchFn?: BuildiumFetchFn;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function assertReadOnlyMethod(method: string): void {
  if (method !== "GET" && isBuildiumReadOnlyMode()) {
    throw new BuildiumApiError(
      "Buildium integration is read-only; mutating API requests are blocked.",
      { code: "READ_ONLY_VIOLATION" },
    );
  }
}

function buildUrl(baseUrl: string, path: string, query?: URLSearchParams): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  if (!query || [...query.keys()].length === 0) {
    return url;
  }
  return `${url}?${query.toString()}`;
}

export async function buildiumGetJson<T>(
  options: BuildiumClientOptions,
  path: string,
  query?: URLSearchParams,
): Promise<BuildiumFetchResult<T>> {
  assertReadOnlyMethod("GET");
  const baseUrl = resolveBuildiumBaseUrl(options.environment);
  const url = buildUrl(baseUrl, path, query);
  const fetchFn = options.fetchFn ?? fetch;

  let lastError: unknown;

  for (let attempt = 0; attempt <= BUILDIUM_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchFn(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-buildium-client-id": options.credentials.clientId,
          "x-buildium-client-secret": options.credentials.clientSecret,
        },
        signal: createTimeoutSignal(BUILDIUM_REQUEST_TIMEOUT_MS),
      });

      const bodyText = await response.text();

      if (!response.ok) {
        const apiError = mapHttpStatusToBuildiumError(response.status, bodyText);
        if (isRetryableBuildiumError(apiError) && attempt < BUILDIUM_MAX_RETRIES) {
          await sleep(BUILDIUM_RETRY_INITIAL_MS * 2 ** attempt);
          lastError = apiError;
          continue;
        }
        throw apiError;
      }

      let data: T;
      try {
        data = bodyText.length > 0 ? (JSON.parse(bodyText) as T) : ([] as T);
      } catch {
        throw new BuildiumApiError("Buildium API returned invalid JSON.", {
          code: "UNKNOWN",
          httpStatus: response.status,
          responseBody: bodyText.slice(0, 500),
        });
      }

      return {
        data,
        totalCount: parseTotalCountHeader(response.headers),
      };
    } catch (error) {
      if (error instanceof BuildiumApiError) {
        if (isRetryableBuildiumError(error) && attempt < BUILDIUM_MAX_RETRIES) {
          lastError = error;
          await sleep(BUILDIUM_RETRY_INITIAL_MS * 2 ** attempt);
          continue;
        }
        throw error;
      }

      if (error instanceof Error && error.name === "TimeoutError") {
        const timeoutError = new BuildiumApiError("Buildium API request timed out.", {
          code: "TIMEOUT",
        });
        if (attempt < BUILDIUM_MAX_RETRIES) {
          lastError = timeoutError;
          await sleep(BUILDIUM_RETRY_INITIAL_MS * 2 ** attempt);
          continue;
        }
        throw timeoutError;
      }

      throw new BuildiumApiError(
        error instanceof Error ? error.message : "Buildium API network error.",
        { code: "NETWORK" },
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new BuildiumApiError("Buildium API request failed after retries.", { code: "UNKNOWN" });
}

/** Guard for future write endpoints — throws when BUILDIUM_READ_ONLY is enabled (default). */
export function assertBuildiumWritesAllowed(): void {
  assertReadOnlyMethod("POST");
}
