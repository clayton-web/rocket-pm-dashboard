export type PhotoEnhancerErrorCode =
  | "unauthenticated"
  | "no_active_org"
  | "forbidden"
  | "invalid_file"
  | "unsupported_type"
  | "empty_file"
  | "file_too_large"
  | "missing_api_key"
  | "model_unavailable"
  | "openai_rejected"
  | "openai_timeout"
  | "openai_malformed"
  | "openai_failed"
  | "rate_limited";

const STATUS_BY_CODE: Record<PhotoEnhancerErrorCode, number> = {
  unauthenticated: 401,
  no_active_org: 403,
  forbidden: 403,
  invalid_file: 400,
  unsupported_type: 400,
  empty_file: 400,
  file_too_large: 413,
  missing_api_key: 503,
  model_unavailable: 403,
  openai_rejected: 502,
  openai_timeout: 504,
  openai_malformed: 502,
  openai_failed: 502,
  rate_limited: 429,
};

export class PhotoEnhancerError extends Error {
  readonly code: PhotoEnhancerErrorCode;
  readonly status: number;

  constructor(code: PhotoEnhancerErrorCode, message: string) {
    super(message);
    this.name = "PhotoEnhancerError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function photoEnhancerErrorJson(error: PhotoEnhancerError): { error: string; code: PhotoEnhancerErrorCode } {
  return { error: error.message, code: error.code };
}
