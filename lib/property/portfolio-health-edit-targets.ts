import type { PortfolioHealthMissingItemKey } from "@/lib/property/portfolio-health";

/**
 * Where a Property Health issue is actually fixed.
 *
 * The mapping is a total `Record` over the issue keys, so adding a health issue without deciding
 * where it is repaired is a compile error rather than a "Fix" button that opens the wrong editor.
 */

/** Editable sections of the canonical Property Detail editor. */
export type PropertyEditSection = "address" | "owner-strata" | "profile" | "status";

export const PROPERTY_EDIT_SECTIONS: PropertyEditSection[] = [
  "address",
  "owner-strata",
  "profile",
  "status",
];

/**
 * Focusable controls, keyed by section.
 *
 * These are the literal `id`/`name` attributes rendered by the extracted edit sections. Keeping
 * them here rather than as loose strings in the row component is what makes a targeted Fix
 * verifiable: a test can assert the form renders the field a target claims to focus.
 */
export const PROPERTY_EDIT_FIELDS = {
  streetLine1: "streetLine1",
  streetLine2: "streetLine2",
  city: "city",
  province: "province",
  postalCode: "postalCode",
  country: "country",
  ownerEmail: "ownerEmail",
  ownerPhone: "ownerPhone",
  strataNotes: "strataNotes",
} as const;

export type PropertyEditField = (typeof PROPERTY_EDIT_FIELDS)[keyof typeof PROPERTY_EDIT_FIELDS];

export type PortfolioHealthEditTarget =
  /** Opens the shared property editor at `section`, optionally focusing `field`. */
  | { kind: "property"; section: PropertyEditSection; field: PropertyEditField | null }
  /** Stays with the existing tenancy edit workflow. */
  | { kind: "tenancy" }
  /** Stays with the existing property document workflow. */
  | { kind: "documents" };

export const PORTFOLIO_HEALTH_EDIT_TARGETS: Record<
  PortfolioHealthMissingItemKey,
  PortfolioHealthEditTarget
> = {
  property_address: { kind: "property", section: "address", field: PROPERTY_EDIT_FIELDS.streetLine1 },
  missing_city: { kind: "property", section: "address", field: PROPERTY_EDIT_FIELDS.city },
  missing_postal_code: {
    kind: "property",
    section: "address",
    field: PROPERTY_EDIT_FIELDS.postalCode,
  },
  owner_contact: {
    kind: "property",
    section: "owner-strata",
    field: PROPERTY_EDIT_FIELDS.ownerEmail,
  },
  strata_notes: {
    kind: "property",
    section: "owner-strata",
    field: PROPERTY_EDIT_FIELDS.strataNotes,
  },

  // Documents are uploaded, not typed into a field; this keeps the existing workflow.
  documents: { kind: "documents" },

  // Tenant, rent and lease data continues to be repaired in the tenancy editor.
  tenant_name: { kind: "tenancy" },
  tenant_email: { kind: "tenancy" },
  tenant_phone: { kind: "tenancy" },
  monthly_rent_zero: { kind: "tenancy" },
  security_deposit_zero: { kind: "tenancy" },
  lease_start_date: { kind: "tenancy" },
  move_in_date: { kind: "tenancy" },
  import_placeholder_dates: { kind: "tenancy" },
};

export function portfolioHealthEditTarget(
  key: PortfolioHealthMissingItemKey,
): PortfolioHealthEditTarget {
  return PORTFOLIO_HEALTH_EDIT_TARGETS[key];
}

/** Narrowing helper for the row component, which only renders property Fix links itself. */
export function portfolioHealthPropertyEditTarget(
  key: PortfolioHealthMissingItemKey,
): { section: PropertyEditSection; field: PropertyEditField | null } | null {
  const target = portfolioHealthEditTarget(key);
  return target.kind === "property" ? { section: target.section, field: target.field } : null;
}

/** Scroll anchor rendered by each extracted section, and the hash used to deep link to it. */
export function propertyEditSectionAnchor(section: PropertyEditSection): string {
  return `edit-${section}`;
}

export function parsePropertyEditSection(
  value: string | null | undefined,
): PropertyEditSection | null {
  const candidate = value?.trim().toLowerCase();
  if (!candidate) return null;
  return PROPERTY_EDIT_SECTIONS.find((section) => section === candidate) ?? null;
}

/**
 * Reads the section out of a `#edit-<section>` hash. Returns null for any other hash so an
 * unrelated fragment never opens an editor.
 */
export function parsePropertyEditSectionFromHash(
  hash: string | null | undefined,
): PropertyEditSection | null {
  if (!hash) return null;
  const withoutHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!withoutHash.startsWith("edit-")) return null;
  return parsePropertyEditSection(withoutHash.slice("edit-".length));
}
