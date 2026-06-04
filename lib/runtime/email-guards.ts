import { isProductionRuntime } from "@/lib/runtime/production-guards";
import { isEmailEnabled, readEmailServiceConfig } from "@/lib/email/email.service";

export function isProductionEmailMisconfigured(): boolean {
  if (!isProductionRuntime()) {
    return false;
  }

  if (process.env.TENANT_AUTH_DEV_SHOW_CODE === "true") {
    return true;
  }

  if (!isEmailEnabled()) {
    return true;
  }

  const config = readEmailServiceConfig();
  if (config.provider !== "resend") {
    return true;
  }
  if (!config.resendApiKey) {
    return true;
  }
  if (!config.from) {
    return true;
  }

  const appPublicUrl =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim();
  if (!appPublicUrl) {
    return true;
  }

  return false;
}

export function productionEmailViolationMessages(): string[] {
  const violations: string[] = [];

  if (process.env.TENANT_AUTH_DEV_SHOW_CODE === "true") {
    violations.push("TENANT_AUTH_DEV_SHOW_CODE must not be enabled in production");
  }

  if (!isEmailEnabled()) {
    violations.push('EMAIL_ENABLED must be "true" in production');
  }

  const config = readEmailServiceConfig();
  if (config.provider !== "resend") {
    violations.push('EMAIL_PROVIDER must be "resend" in production');
  }
  if (!config.resendApiKey) {
    violations.push("RESEND_API_KEY is required in production");
  }
  if (!config.from) {
    violations.push("EMAIL_FROM is required in production");
  }

  const appPublicUrl =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim();
  if (!appPublicUrl) {
    violations.push("APP_PUBLIC_URL (or NEXTAUTH_URL / AUTH_URL) is required in production");
  }

  return violations;
}

export function productionEmailViolationMessage(): string {
  return productionEmailViolationMessages().join("; ");
}
