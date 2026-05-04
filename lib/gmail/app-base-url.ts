export function getAppBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  if (!raw) {
    return "http://localhost:3000";
  }
  return raw.replace(/\/+$/, "");
}
