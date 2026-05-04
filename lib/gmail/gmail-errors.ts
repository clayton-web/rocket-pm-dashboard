export class GmailAuthError extends Error {
  readonly code: "needs_reauth" | "unauthorized" | "forbidden";

  constructor(code: GmailAuthError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "GmailAuthError";
  }
}

export function isGmailAuthError(error: unknown): error is GmailAuthError {
  return error instanceof GmailAuthError;
}
