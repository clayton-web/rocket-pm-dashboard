export class ScraperTimeoutError extends Error {
  readonly provider = "craigslist" as const;

  constructor(message = "Listing source request timed out.") {
    super(message);
    this.name = "ScraperTimeoutError";
  }
}

export class ScraperFetchError extends Error {
  readonly provider: string;
  readonly httpStatus?: number;
  readonly diagnostics?: ScraperFetchDiagnostics;

  constructor(
    provider: string,
    message: string,
    httpStatus?: number,
    diagnostics?: ScraperFetchDiagnostics,
  ) {
    super(message);
    this.name = "ScraperFetchError";
    this.provider = provider;
    this.httpStatus = httpStatus;
    this.diagnostics = diagnostics;
  }
}

export type ScraperFetchDiagnostics = {
  requestUrl: string;
  httpStatus?: number;
  responseBodySnippet?: string;
  elapsedMs: number;
};
