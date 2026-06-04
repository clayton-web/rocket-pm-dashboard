"use server";

import type { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import { getApplicationById, setApplicationReviewStatus } from "@/lib/services/application.service";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import {
  buildEmergencyContactFromApplication,
  buildInitialLeaseSetupFromApplication,
} from "@/lib/leasing/application-to-tenancy";
import { createTenancyFromApprovedApplication } from "@/lib/services/tenancy.service";
import { createTenancyContact } from "@/lib/services/tenancyContact.service";

import {
  convertFormDatesToServiceInput,
  parseConvertTenancyFormInput,
} from "@/lib/validation/tenancy-conversion";

export type ReviewApplicationResult = { ok: true } | { ok: false; error: string };

export type ConvertTenancyResult =
  | { ok: true; tenancyId: string }
  | { ok: false; error: string };

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

    if (application.status !== "approved") {
      return { ok: false, error: "Application must be approved before creating a tenancy" };
    }

    const existingTenancy = await prisma.tenancy.findUnique({
      where: { applicationId: application.id },
      select: { id: true },
    });
    if (existingTenancy) {
      return { ok: false, error: "A tenancy already exists for this application" };
    }

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

    const tenancy = await prisma.$transaction(async (tx) => {
      const db = tx as PrismaClient;
      const dup = await db.tenancy.findUnique({
        where: { applicationId: application.id },
        select: { id: true },
      });
      if (dup) {
        throw new Error("A tenancy already exists for this application");
      }

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

      return row;
    });

    revalidatePath("/leasing/applications");
    revalidatePath(`/leasing/applications/${trimmedId}`);
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
    const message = e instanceof Error ? e.message : "Could not create tenancy";
    return { ok: false, error: message };
  }
}
