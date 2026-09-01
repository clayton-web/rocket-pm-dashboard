import type { PrismaClient, Property } from "@prisma/client";
import {
  findLikelyDuplicateAddresses,
  type PropertyAddressDuplicateMatch,
  type PropertyAddressIdentity,
} from "@/lib/property/property-address-duplicates";
import type {
  PropertyAddressDuplicateQuery,
  PropertyAddressFormInput,
} from "@/lib/validation/property-address";
import { requirePropertyManagerAccess, requireStaff } from "./property-access";
import { NotFoundError } from "./errors";
import type { StaffContext } from "./staff-context";
import { updateProperty } from "./property.service";

/**
 * Explicit wrapper for manual address edits.
 *
 * It exists so the `Property.name` synchronization rule lives in exactly one place and rides the
 * same authoritative `updateProperty` call as the address fields — one update, one ActivityLog
 * entry, one old/new snapshot pair. Callers never assemble an address update themselves.
 */

export type UpdatePropertyAddressResult = {
  property: Property;
  /** True when `streetLine1` changed and `name` was re-synchronized with it. */
  nameSynchronized: boolean;
  /** False when the stored address already matched, so nothing was written. */
  changed: boolean;
};

const ADDRESS_FIELDS = [
  "streetLine1",
  "streetLine2",
  "city",
  "province",
  "postalCode",
  "country",
] as const;

/**
 * Compares what is stored against what would be stored.
 *
 * The comparison is deliberately against the *persisted* representation on both sides, never the
 * raw form input: the parser has already trimmed, collapsed whitespace, upper-cased and spaced the
 * postal code, emptied `streetLine2` to null and defaulted province and country. So `V3H1A1` typed
 * into the form is a no-op only when the stored value is already `V3H 1A1`, and a stored value that
 * is genuinely unnormalized still gets corrected.
 */
function storedAddressMatches(stored: Property, input: PropertyAddressFormInput): boolean {
  return ADDRESS_FIELDS.every((field) => stored[field] === input[field]);
}

/**
 * Writes all six address fields, or nothing at all.
 *
 * A save whose normalized values already match the database does not touch the row: no
 * `updateProperty` call, so no `updatedAt` bump and no ActivityLog entry. Opening the editor from a
 * Property Health Fix action and saving without editing is a common gesture, and it should not
 * leave an audit trail claiming the address was changed.
 *
 * `name` is rewritten only when `streetLine1` actually changes, which is the approved rule. Both
 * decisions run off the same persisted-value comparison, so the street line and the name it mirrors
 * can never disagree about whether a change happened.
 */
export async function updatePropertyAddress(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  input: PropertyAddressFormInput,
): Promise<UpdatePropertyAddressResult> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);

  const before = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!before) throw new NotFoundError("Property not found");

  if (storedAddressMatches(before, input)) {
    return { property: before, nameSynchronized: false, changed: false };
  }

  const streetChanged = before.streetLine1 !== input.streetLine1;

  const property = await updateProperty(prisma, principal, propertyId, {
    streetLine1: input.streetLine1,
    streetLine2: input.streetLine2,
    city: input.city,
    province: input.province,
    postalCode: input.postalCode,
    country: input.country,
    ...(streetChanged ? { name: input.streetLine1 } : {}),
  });

  return { property, nameSynchronized: streetChanged, changed: true };
}

/**
 * Advisory same-organization duplicate lookup. Read-only; never called on the save path.
 *
 * Candidates are narrowed by city, which is indexed and is also a precondition of the comparison
 * itself — two properties in different municipalities are never reported as duplicates. The final
 * decision is made by the pure comparator so it can be tested without a database.
 */
export async function findPropertyAddressDuplicates(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  address: PropertyAddressDuplicateQuery,
): Promise<PropertyAddressDuplicateMatch[]> {
  requireStaff(principal);
  await requirePropertyManagerAccess(prisma, principal, propertyId);

  const rows = await prisma.property.findMany({
    where: {
      organizationId: principal.organizationId,
      id: { not: propertyId },
      city: { equals: address.city, mode: "insensitive" },
    },
    select: {
      id: true,
      streetLine1: true,
      streetLine2: true,
      city: true,
      postalCode: true,
    },
    take: 200,
  });

  const existing: PropertyAddressIdentity[] = rows.map((row) => ({
    propertyId: row.id,
    streetLine1: row.streetLine1,
    streetLine2: row.streetLine2,
    city: row.city,
    postalCode: row.postalCode,
  }));

  return findLikelyDuplicateAddresses(
    {
      propertyId,
      streetLine1: address.streetLine1,
      streetLine2: address.streetLine2 ?? null,
      city: address.city,
      postalCode: address.postalCode,
    },
    existing,
  );
}
