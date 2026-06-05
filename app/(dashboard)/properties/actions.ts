"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { createProperty } from "@/lib/services/property.service";
import { createUnit } from "@/lib/services/unit.service";
import {
  parseCreatePropertyFormInput,
  parseCreateUnitFormInput,
} from "@/lib/validation/property-form";

export type PropertyActionResult =
  | { ok: true; propertyId?: string; unitId?: string }
  | { ok: false; error: string };

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
    });
    revalidatePath("/properties");
    revalidatePath(`/properties/${property.id}`);
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
    revalidatePath("/properties");
    revalidatePath(`/properties/${trimmedPropertyId}`);
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
