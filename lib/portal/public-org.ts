/** Public tenant portal is scoped to a single org slug (default Axford seed). */
export function getPublicPortalOrgSlug(): string {
  return process.env.MAINTENANCE_PUBLIC_ORG_SLUG?.trim() || "axford";
}
