"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import {
  PROPERTY_HARD_DELETE_CONFIRMATION_TEXT,
  PropertyHardDeleteBlockedError,
  hardDeleteDummyProperty,
} from "@/lib/services/hard-delete-dummy-property";
import {
  findPropertyAddressDuplicates,
  updatePropertyAddress,
} from "@/lib/services/property-address.service";
import {
  createProperty,
  updatePropertyOwnerStrata,
  updatePropertyProfile,
  updatePropertyServiceRelationship,
} from "@/lib/services/property.service";
import { createUnit } from "@/lib/services/unit.service";
import { loadPortfolioHealthForStaff } from "@/lib/property/portfolio-health-staff";
import { parseCleanupFiltersParam } from "@/lib/property/portfolio-health-cleanup-filters";
import {
  flattenHealthCleanupPropertyQueue,
  selectNextPropertyInCleanupQueue,
} from "@/lib/property/portfolio-health-cleanup-queue";
import {
  portfolioHealthPropertyEditTarget,
  type PropertyEditField,
  type PropertyEditSection,
} from "@/lib/property/portfolio-health-edit-targets";
import {
  buildPortfolioHealthView,
  parsePortfolioHealthStatusFilter,
} from "@/lib/property/portfolio-health-view";
import {
  orderPortfolioHealthIssueKeys,
  parsePortfolioHealthSort,
} from "@/lib/property/portfolio-health-ranking";
import { parseSearchQueryParam } from "@/lib/property/portfolio-health-search";
import type { PropertyAddressDuplicateMatch } from "@/lib/property/property-address-duplicates";
import {
  parseCreatePropertyFormInput,
  parseCreateUnitFormInput,
  parsePropertyServiceRelationshipFormInput,
} from "@/lib/validation/property-form";
import {
  parsePropertyAddressDuplicateQuery,
  parsePropertyAddressFormInput,
} from "@/lib/validation/property-address";
import { parsePropertyProfileFormInput } from "@/lib/validation/property-profile";
import { parsePropertyOwnerStrataFormInput } from "@/lib/validation/property-owner-strata";

export type PropertyActionResult =
  | { ok: true; propertyId?: string; unitId?: string }
  | { ok: false; error: string };

/**
 * Property Health reads the same rows as the property pages, so every successful property
 * mutation has to invalidate it too or the cleanup queue keeps showing resolved issues.
 */
function revalidatePropertyPaths(propertyId: string): void {
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties/health");
}

export async function createPropertyAction(formData: unknown): Promise<PropertyActionResult> {
  const parsed = parseCreatePropertyFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const property = await createProperty(prisma, ctx, {
      organizationId: ctx.organizationId,
      name: parsed.name,
      streetLine1: parsed.streetLine1,
      streetLine2: parsed.streetLine2,
      city: parsed.city,
      province: parsed.province,
      postalCode: parsed.postalCode,
      serviceRelationship: parsed.serviceRelationship,
      propertyType: parsed.propertyType,
      bedrooms: parsed.bedrooms,
      bathrooms: parsed.bathrooms,
      approxSqft: parsed.approxSqft,
    });
    revalidatePropertyPaths(property.id);
    return { ok: true, propertyId: property.id };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not create property";
    return { ok: false, error: message };
  }
}

export async function createUnitAction(
  propertyId: string,
  formData: unknown,
): Promise<PropertyActionResult> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) {
    return { ok: false, error: "Invalid property id" };
  }

  const parsed = parseCreateUnitFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const unit = await createUnit(prisma, ctx, trimmedPropertyId, {
      unitNumber: parsed.unitNumber,
      floor: parsed.floor,
      bedrooms: parsed.bedrooms,
    });
    revalidatePropertyPaths(trimmedPropertyId);
    return { ok: true, unitId: unit.id };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not create unit";
    return { ok: false, error: message };
  }
}

export async function hardDeletePropertyAction(
  propertyId: string,
  confirmation: string,
): Promise<PropertyActionResult> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) {
    return { ok: false, error: "Invalid property id" };
  }
  if (confirmation.trim() !== PROPERTY_HARD_DELETE_CONFIRMATION_TEXT) {
    return { ok: false, error: "Type DELETE to confirm permanent deletion." };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await hardDeleteDummyProperty(prisma, ctx, trimmedPropertyId);
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof PropertyHardDeleteBlockedError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not delete property";
    return { ok: false, error: message };
  }

  revalidatePath("/properties");
  revalidatePath("/properties/health");
  redirect("/properties");
}

export async function updatePropertyProfileAction(
  propertyId: string,
  formData: unknown,
): Promise<PropertyActionResult> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) {
    return { ok: false, error: "Invalid property id" };
  }

  const parsed = parsePropertyProfileFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await updatePropertyProfile(prisma, ctx, trimmedPropertyId, parsed);
    revalidatePropertyPaths(trimmedPropertyId);
    return { ok: true, propertyId: trimmedPropertyId };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not update property profile";
    return { ok: false, error: message };
  }
}

export async function updatePropertyServiceRelationshipAction(
  propertyId: string,
  formData: unknown,
): Promise<PropertyActionResult> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) {
    return { ok: false, error: "Invalid property id" };
  }

  const parsed = parsePropertyServiceRelationshipFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await updatePropertyServiceRelationship(
      prisma,
      ctx,
      trimmedPropertyId,
      parsed.serviceRelationship,
    );
    revalidatePropertyPaths(trimmedPropertyId);
    return { ok: true, propertyId: trimmedPropertyId };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not update service relationship";
    return { ok: false, error: message };
  }
}

export async function updatePropertyOwnerStrataAction(
  propertyId: string,
  formData: unknown,
): Promise<PropertyActionResult> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) {
    return { ok: false, error: "Invalid property id" };
  }

  const parsed = parsePropertyOwnerStrataFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await updatePropertyOwnerStrata(prisma, ctx, trimmedPropertyId, parsed);
    revalidatePropertyPaths(trimmedPropertyId);
    return { ok: true, propertyId: trimmedPropertyId };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not update owner and strata details";
    return { ok: false, error: message };
  }
}

export type PropertyAddressActionResult =
  | { ok: true; propertyId: string; nameSynchronized: boolean; changed: boolean }
  | { ok: false; error: string };

/**
 * Manual address save. Duplicate addresses and active tenancies are surfaced as warnings by the
 * editor and are deliberately not consulted here — this action never refuses a valid address.
 *
 * A save that matches the stored address writes nothing and revalidates nothing; there is no cache
 * entry to invalidate when no data moved.
 */
export async function updatePropertyAddressAction(
  propertyId: string,
  formData: unknown,
): Promise<PropertyAddressActionResult> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) {
    return { ok: false, error: "Invalid property id" };
  }

  const parsed = parsePropertyAddressFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const result = await updatePropertyAddress(prisma, ctx, trimmedPropertyId, parsed);
    if (result.changed) {
      revalidatePropertyPaths(trimmedPropertyId);
    }
    return {
      ok: true,
      propertyId: trimmedPropertyId,
      nameSynchronized: result.nameSynchronized,
      changed: result.changed,
    };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not update property address";
    return { ok: false, error: message };
  }
}

export type PropertyAddressDuplicateCheckResult =
  | { ok: true; duplicates: PropertyAddressDuplicateMatch[] }
  | { ok: false; error: string };

/** Read-only advisory check used by the address editor before the staff member saves. */
export async function checkPropertyAddressDuplicatesAction(
  propertyId: string,
  formData: unknown,
): Promise<PropertyAddressDuplicateCheckResult> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) {
    return { ok: false, error: "Invalid property id" };
  }

  // Deliberately lenient: the addresses most likely to be duplicates are the ones the save
  // parser rejects, and the check also runs while the form is half-typed.
  const parsed = parsePropertyAddressDuplicateQuery(formData);
  if (!parsed) {
    return { ok: true, duplicates: [] };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const duplicates = await findPropertyAddressDuplicates(
      prisma,
      ctx,
      trimmedPropertyId,
      parsed,
    );
    return { ok: true, duplicates };
  } catch (e) {
    if (e instanceof StaffAuthError || e instanceof NotFoundError || e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not check for duplicate addresses";
    return { ok: false, error: message };
  }
}

/** The carried Property Health worklist state, as raw query-string values. */
export type HealthCleanupQueueContextInput = {
  filters: string;
  query: string;
  status: string;
  sort: string;
};

export type NextHealthCleanupProperty = {
  propertyId: string;
  /** Editor section and field for the next property's highest-priority repairable issue. */
  section: PropertyEditSection;
  field: PropertyEditField | null;
};

/**
 * Next property in the cleanup queue.
 *
 * The queue is rebuilt from live data through `buildPortfolioHealthView`, the same pipeline the
 * Property Health list renders — filters, then search, then status, then sort. Recomputing rather
 * than carrying an index is what makes the loop correct after a save: the property just fixed no
 * longer matches, so it drops out and the queue advances.
 *
 * The target section travels with the id so the next hop opens on the issue that put the property
 * in the queue, rather than dropping the staff member at the top of a page to hunt for it.
 */
export async function resolveNextHealthCleanupPropertyAction(
  currentPropertyId: string,
  context: HealthCleanupQueueContextInput,
): Promise<
  { ok: true; next: NextHealthCleanupProperty | null } | { ok: false; error: string }
> {
  const trimmedId = currentPropertyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid property id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const { rows } = await loadPortfolioHealthForStaff(ctx);
    const view = buildPortfolioHealthView({
      rows,
      filters: parseCleanupFiltersParam(context.filters),
      query: parseSearchQueryParam(context.query),
      status: parsePortfolioHealthStatusFilter(context.status),
      sort: parsePortfolioHealthSort(context.sort),
    });
    const queue = flattenHealthCleanupPropertyQueue(view.rows);
    const next = selectNextPropertyInCleanupQueue(queue, trimmedId);
    if (!next) return { ok: true, next: null };

    const ordered = orderPortfolioHealthIssueKeys(next.editableIssueKeys);
    const target = ordered.length > 0 ? portfolioHealthPropertyEditTarget(ordered[0]) : null;

    return {
      ok: true,
      next: {
        propertyId: next.propertyId,
        section: target?.section ?? "address",
        field: target?.field ?? null,
      },
    };
  } catch (e) {
    if (e instanceof StaffAuthError || e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not resolve the next property";
    return { ok: false, error: message };
  }
}
