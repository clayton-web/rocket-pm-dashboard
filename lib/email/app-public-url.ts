import { isProductionRuntime } from "@/lib/runtime/production-guards";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Public app origin for absolute links in transactional email. */
export function getAppPublicUrl(): string {
  const configured =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim();

  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (isProductionRuntime()) {
    throw new Error("APP_PUBLIC_URL is required in production for transactional email links.");
  }

  return "http://localhost:3000";
}

export function buildAppPublicUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppPublicUrl()}${normalizedPath}`;
}
