export class ScraperTimeoutError extends Error {
  readonly provider = "craigslist" as const;

  constructor(message = "Listing source request timed out.") {
    super(message);
    this.name = "ScraperTimeoutError";
  }
}

export class ScraperFetchError extends Error {
  readonly provider: string;

  constructor(provider: string, message: string) {
    super(message);
    this.name = "ScraperFetchError";
    this.provider = provider;
  }
}
