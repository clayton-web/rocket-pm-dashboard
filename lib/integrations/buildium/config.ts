import type { BuildiumEnvironment } from "@prisma/client";

export const BUILDIUM_PRODUCTION_BASE_URL = "https://api.buildium.com";
export const BUILDIUM_SANDBOX_BASE_URL = "https://apisandbox.buildium.com";

export const BUILDIUM_REQUEST_TIMEOUT_MS = 30_000;
export const BUILDIUM_MAX_RETRIES = 3;
export const BUILDIUM_RETRY_INITIAL_MS = 200;

/** When true (default), the client rejects non-GET requests. */
export function isBuildiumReadOnlyMode(): boolean {
  const raw = process.env.BUILDIUM_READ_ONLY?.trim().toLowerCase();
  if (!raw || raw === "true" || raw === "1" || raw === "yes") {
    return true;
  }
  return raw === "false" || raw === "0" || raw === "no" ? false : true;
}

export function resolveBuildiumBaseUrl(environment: BuildiumEnvironment): string {
  const override = process.env.BUILDIUM_BASE_URL?.trim();
  if (override) {
    return override.replace(/\/+$/, "");
  }
  return environment === "SANDBOX" ? BUILDIUM_SANDBOX_BASE_URL : BUILDIUM_PRODUCTION_BASE_URL;
}
