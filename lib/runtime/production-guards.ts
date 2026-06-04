/**
 * Production/staging runtime safety checks.
 * Fail closed on dangerous dev-only flags when NODE_ENV=production.
 */

import {
  isProductionDocumentStorageMisconfigured,
  productionDocumentStorageViolationMessage,
} from "@/lib/runtime/document-storage-guards";

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Server-side dev email-only login; never enabled in production. */
export function isDevCredentialsLoginEnabled(): boolean {
  if (isProductionRuntime()) return false;
  return process.env.DEV_CREDENTIALS_LOGIN === "true";
}

/**
 * Validates env flags that must never be set in production.
 * Safe to call during `next build` — only rejects explicitly dangerous values.
 */
export function validateProductionRuntimeConfig(): void {
  if (!isProductionRuntime()) return;

  const violations: string[] = [];

  if (process.env.DEV_CREDENTIALS_LOGIN === "true") {
    violations.push("DEV_CREDENTIALS_LOGIN must be false in production");
  }
  if (process.env.NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN === "true") {
    violations.push("NEXT_PUBLIC_DEV_CREDENTIALS_LOGIN must be false in production builds");
  }
  if (process.env.ALLOW_INSECURE_GMAIL_TOKEN_STORAGE === "true") {
    violations.push("ALLOW_INSECURE_GMAIL_TOKEN_STORAGE must not be enabled in production");
  }
  if (isProductionDocumentStorageMisconfigured()) {
    violations.push(productionDocumentStorageViolationMessage());
  }

  if (violations.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${violations.join("\n- ")}`);
  }
}
