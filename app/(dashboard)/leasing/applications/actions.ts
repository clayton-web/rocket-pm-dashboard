"use server";

import type { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import {
  PlacementOnlyConversionBlockedError,
  getApplicationConversionPolicy,
  assertCanConvertApplicationToManagedTenancy,
} from "@/lib/leasing/application-conversion-policy";
import {
  buildEmergencyContactFromApplication,
  buildInitialLeaseSetupFromApplication,
} from "@/lib/leasing/application-to-tenancy";
import {
  closeRentalListingForLeasingOutcome,
  resolveListingForOutcomeClose,
} from "@/lib/leasing/leasing-outcome-listing";
import { getApplicationById, setApplicationReviewStatus } from "@/lib/services/application.service";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { createTenancyFromApprovedApplication } from "@/lib/services/tenancy.service";
import { createTenancyContact } from "@/lib/services/tenancyContact.service";
import {
  ListingSelectionRequiredError,
  completeTenantPlacement,
  parsePlacementDateOnly,
  PlacementCompletionNotAllowedError,
} from "@/lib/services/tenant-placement.service";
import {
  convertFormDatesToServiceInput,
  parseConvertTenancyFormInput,
} from "@/lib/validation/tenancy-conversion";
import { parseCompletePlacementFormInput } from "@/lib/validation/tenant-placement";

export type ReviewApplicationResult = { ok: true } | { ok: false; error: string };

export type ConvertTenancyResult =
  | { ok: true; tenancyId: string }
  | { ok: false; error: string; listingCandidates?: { id: string; headline: string | null; status: string }[] };

export type CompletePlacementResult =
  | { ok: true; placementId: string }
  | { ok: false; error: string; listingCandidates?: { id: string; headline: string | null; status: string }[] };

const REVIEW_STATUSES = new Set(["under_review", "approved", "declined"]);

function hasPartialEmergencyContact(application: {
  emergencyContactFirstName: string | null;
  emergencyContactLastName: string | null;
  emergencyContactPhone: string | null;
}): boolean {
  return Boolean(
    application.emergencyContactFirstName?.trim() ||
      application.emergencyContactLastName?.trim() ||
      application.emergencyContactPhone?.trim(),
  );
}

export async function setApplicationReviewAction(
  applicationId: string,
  status: string,
): Promise<ReviewApplicationResult> {
  const trimmedId = applicationId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid application id" };
  }
  if (!REVIEW_STATUSES.has(status)) {
    return { ok: false, error: "Invalid review action" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    await setApplicationReviewStatus(prisma, ctx, trimmedId, {
      status: status as "under_review" | "approved" | "declined",
    });
    revalidatePath("/leasing/applications");
    revalidatePath(`/leasing/applications/${trimmedId}`);
    return { ok: true };
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
    const message = e instanceof Error ? e.message : "Could not update application";
    return { ok: false, error: message };
  }
}

export async function convertApprovedApplicationAction(
  applicationId: string,
  formData: unknown,
): Promise<ConvertTenancyResult> {
  const trimmedId = applicationId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid application id" };
  }

  const parsedForm = parseConvertTenancyFormInput(formData);
  if ("error" in parsedForm) {
    return { ok: false, error: parsedForm.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const application = await getApplicationById(prisma, ctx, trimmedId);

    const property = await prisma.property.findFirst({
      where: { id: application.propertyId, organizationId: ctx.organizationId },
      select: { id: true, serviceRelationship: true },
    });
    if (!property) {
      return { ok: false, error: "Property not found" };
    }

    const existingTenancy = await prisma.tenancy.findUnique({
      where: { applicationId: application.id },
      select: { id: true },
    });

    const policy = getApplicationConversionPolicy({
      applicationStatus: application.status,
      hasTenancy: existingTenancy != null,
      serviceRelationship: property.serviceRelationship,
    });
    assertCanConvertApplicationToManagedTenancy(policy);

    const firstName = application.firstName?.trim() ?? "";
    const lastName = application.lastName?.trim() ?? "";
    const email = application.email?.trim() ?? "";
    if (!firstName) return { ok: false, error: "Applicant first name is required" };
    if (!lastName) return { ok: false, error: "Applicant last name is required" };
    if (!email) return { ok: false, error: "Applicant email is required" };

    const leaseInput = convertFormDatesToServiceInput(parsedForm);
    const initialLeaseSetup = buildInitialLeaseSetupFromApplication(
      application,
      leaseInput.leaseEndDate,
    );

    if (hasPartialEmergencyContact(application)) {
      const emergency = buildEmergencyContactFromApplication(application);
      if (!emergency) {
        return {
          ok: false,
          error:
            "Emergency contact requires first name, last name, and phone when any emergency field is provided",
        };
      }
    }

    const formListingId =
      typeof formData === "object" &&
      formData !== null &&
      typeof (formData as { rentalListingId?: unknown }).rentalListingId === "string"
        ? (formData as { rentalListingId: string }).rentalListingId.trim()
        : null;

    const tenancy = await prisma.$transaction(async (tx) => {
      const db = tx as PrismaClient;
      const dup = await db.tenancy.findUnique({
        where: { applicationId: application.id },
        select: { id: true },
      });
      if (dup) {
        throw new Error("A tenancy already exists for this application");
      }

      const listingResolution = await resolveListingForOutcomeClose(db, {
        propertyId: application.propertyId,
        unitId: application.unitId,
        applicationRentalListingId: application.rentalListingId,
        explicitRentalListingId: formListingId,
      });
      if (listingResolution.kind === "needs_selection") {
        throw new ListingSelectionRequiredError(listingResolution.candidates);
      }

      // Reloads property.serviceRelationship from DB and enforces policy again;
      // PRE_MANAGEMENT → MANAGED happens inside createTenancyFromApprovedApplication.
      const row = await createTenancyFromApprovedApplication(db, ctx, {
        applicationId: application.id,
        status: "pending_move_in",
        ...leaseInput,
        leaseSetupJson: initialLeaseSetup,
      });

      await createTenancyContact(db, ctx, row.id, {
        firstName,
        lastName,
        email,
        phone: application.phone?.trim() || null,
        contactType: "tenant",
        portalAccessEnabled: true,
      });

      const emergencyContact = buildEmergencyContactFromApplication(application);
      if (emergencyContact) {
        await createTenancyContact(db, ctx, row.id, emergencyContact);
      }

      if (listingResolution.kind === "close") {
        await closeRentalListingForLeasingOutcome(db, ctx, listingResolution.listing.id, {
          reason: "managed_tenancy_conversion",
          applicationId: application.id,
        });
      }

      return row;
    });

    revalidatePath("/leasing/applications");
    revalidatePath(`/leasing/applications/${trimmedId}`);
    revalidatePath(`/properties/${application.propertyId}`);
    revalidatePath(`/leasing/tenancies/${tenancy.id}`);
    return { ok: true, tenancyId: tenancy.id };
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
    if (e instanceof PlacementOnlyConversionBlockedError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ListingSelectionRequiredError) {
      return { ok: false, error: e.message, listingCandidates: e.candidates };
    }
    const message = e instanceof Error ? e.message : "Could not create tenancy";
    return { ok: false, error: message };
  }
}

export async function completeTenantPlacementAction(
  applicationId: string,
  formData: unknown,
): Promise<CompletePlacementResult> {
  const trimmedId = applicationId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid application id" };
  }

  const parsedForm = parseCompletePlacementFormInput(formData);
  if ("error" in parsedForm) {
    return { ok: false, error: parsedForm.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const placement = await completeTenantPlacement(prisma, ctx, {
      applicationId: trimmedId,
      leaseStartDate: parsePlacementDateOnly(parsedForm.leaseStartDate, "Lease start date"),
      leaseEndDate: parsedForm.leaseEndDate
        ? parsePlacementDateOnly(parsedForm.leaseEndDate, "Lease end date")
        : null,
      monthlyRent: parsedForm.monthlyRent,
      landlordHandoffNotes: parsedForm.landlordHandoffNotes,
      internalNotes: parsedForm.internalNotes,
      rentalListingId: parsedForm.rentalListingId,
    });

    const application = await getApplicationById(prisma, ctx, trimmedId);
    revalidatePath("/leasing/applications");
    revalidatePath(`/leasing/applications/${trimmedId}`);
    revalidatePath(`/properties/${application.propertyId}`);
    return { ok: true, placementId: placement.id };
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
    if (e instanceof PlacementCompletionNotAllowedError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ListingSelectionRequiredError) {
      return { ok: false, error: e.message, listingCandidates: e.candidates };
    }
    const message = e instanceof Error ? e.message : "Could not complete placement";
    return { ok: false, error: message };
  }
}
