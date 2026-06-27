export type BuildiumApiErrorCode =
  | "READ_ONLY_VIOLATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "NETWORK"
  | "TIMEOUT"
  | "UNKNOWN";

export class BuildiumApiError extends Error {
  readonly code: BuildiumApiErrorCode;
  readonly httpStatus?: number;
  readonly responseBody?: string;

  constructor(
    message: string,
    args: { code: BuildiumApiErrorCode; httpStatus?: number; responseBody?: string },
  ) {
    super(message);
    this.name = "BuildiumApiError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.responseBody = args.responseBody;
  }
}

export function mapHttpStatusToBuildiumError(status: number, bodyText: string): BuildiumApiError {
  if (status === 401) {
    return new BuildiumApiError("Buildium API credentials could not be authorized.", {
      code: "UNAUTHORIZED",
      httpStatus: status,
      responseBody: bodyText,
    });
  }
  if (status === 403) {
    return new BuildiumApiError("Buildium API credentials lack permission for this resource.", {
      code: "FORBIDDEN",
      httpStatus: status,
      responseBody: bodyText,
    });
  }
  if (status === 404) {
    return new BuildiumApiError("Buildium API resource not found.", {
      code: "NOT_FOUND",
      httpStatus: status,
      responseBody: bodyText,
    });
  }
  if (status === 429) {
    return new BuildiumApiError("Buildium API rate limit exceeded.", {
      code: "RATE_LIMITED",
      httpStatus: status,
      responseBody: bodyText,
    });
  }
  if (status === 422 || status === 400) {
    return new BuildiumApiError("Buildium API rejected the request.", {
      code: "VALIDATION",
      httpStatus: status,
      responseBody: bodyText,
    });
  }
  return new BuildiumApiError(`Buildium API request failed (${status}).`, {
    code: "UNKNOWN",
    httpStatus: status,
    responseBody: bodyText,
  });
}

export function isRetryableBuildiumError(error: unknown): boolean {
  if (!(error instanceof BuildiumApiError)) {
    return false;
  }
  if (error.code === "RATE_LIMITED") {
    return true;
  }
  const status = error.httpStatus;
  return status === 502 || status === 503 || status === 504;
}
