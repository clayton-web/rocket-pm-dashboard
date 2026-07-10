"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import {
  getNextTenancyStatus,
  isValidTenancyStatusTransition,
  STAFF_BLOCKED_ADVANCE_TARGETS,
} from "@/lib/leasing/tenancy-lifecycle";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { getTenancyById, updateTenancy } from "@/lib/services/tenancy.service";
import { updateTenancyContact } from "@/lib/services/tenancyContact.service";
import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";
import {
  completeMoveOutInspection,
  scheduleMoveOutInspection,
} from "@/lib/services/move-out-inspection.service";
import {
  leaseSetupFormToJson,
  parseLeaseSetupFormInput,
} from "@/lib/validation/lease-setup";
import {
  generateRtb1DraftForTenancy,
  Rtb1GenerationNotReadyError,
} from "@/lib/leasing/rtb1/generate-rtb1-draft";
import {
  LeaseSigningError,
  refreshLeaseSigningLink,
  sendLeaseForSignature,
  submitPmLeaseSignature,
} from "@/lib/leasing/lease-signing.service";
import { loadLeaseSigningEmailRecipient } from "@/lib/email/lease-signing-email-context";
import { sendLeaseSigningRequestEmail } from "@/lib/email/send-transactional-emails";
import { leaseSigningTokenExpiresAt } from "@/lib/leasing/lease-signing-token";
import { Rtb1DraftBlockedDuringSigningError } from "@/lib/leasing/lease-signing-guards";
import {
  activationBlockReasonForAdvance,
  loadTenancyActivationReadiness,
} from "@/lib/leasing/tenancy-activation-gate";
import { applyTenancyDetailsUpdate } from "@/lib/leasing/apply-tenancy-details-update";
import {
  flattenHealthCleanupTenancyQueue,
  selectNextTenancyInCleanupQueue,
} from "@/lib/property/portfolio-health-cleanup-queue";
import {
  filterPortfolioHealthCleanupQueue,
  parseCleanupFiltersParam,
} from "@/lib/property/portfolio-health-cleanup-filters";
import { loadPortfolioHealthForStaff } from "@/lib/property/portfolio-health-staff";
import { parseTenancyEditFormInput } from "@/lib/validation/tenancy-edit";
import type { TenancyStatus } from "@prisma/client";

export type TenancyActionResult = { ok: true } | { ok: false; error: string };

export type GenerateRtb1DraftResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

export type SendLeaseForSignatureResult =
  | { ok: true; signatureRequestId: string; signingUrl: string; emailWarning?: string }
  | { ok: false; error: string };

function clientIpFromHeaders(forwardedFor: string | null, userAgent: string | null) {
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || null,
    userAgent,
  };
}

export async function advanceTenancyStatusAction(
  tenancyId: string,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid tenancy id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const tenancy = await getTenancyById(prisma, ctx, trimmedId);
    const current = tenancy.status as TenancyStatus;
    const next = getNextTenancyStatus(current);

    if (!next) {
      return { ok: false, error: "No further status transition is available" };
    }

    if (!isValidTenancyStatusTransition(current, next)) {
      return { ok: false, error: "Invalid status transition" };
    }

    if (next != null && STAFF_BLOCKED_ADVANCE_TARGETS.has(next)) {
      if (next === "notice_received") {
        return {
          ok: false,
          error:
            "Accept a tenant notice on Offboarding before updating status. Manual notice received is not supported.",
        };
      }
      if (next === "move_out_scheduled") {
        return {
          ok: false,
          error:
            "Schedule move-out from the accepted tenant notice on Offboarding before advancing status.",
        };
      }
      if (next === "inspection_scheduled") {
        return {
          ok: false,
          error: "Schedule the move-out inspection on this tenancy before advancing status.",
        };
      }
      if (next === "inspection_completed") {
        return {
          ok: false,
          error: "Complete the move-out inspection on this tenancy before advancing status.",
        };
      }
      return {
        ok: false,
        error: "Use the dedicated offboarding actions on this tenancy before advancing status.",
      };
    }

    if (next === "active") {
      const readiness = await loadTenancyActivationReadiness(prisma, trimmedId);
      const blockReason = activationBlockReasonForAdvance(current, next, readiness);
      if (blockReason) {
        return { ok: false, error: blockReason };
      }
    }

    await updateTenancy(prisma, ctx, trimmedId, { status: next });
    revalidatePath("/leasing/tenancies");
    revalidatePath("/leasing/offboarding");
    revalidatePath(`/leasing/tenancies/${trimmedId}`);

    revalidatePath("/operations");
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
    const message = e instanceof Error ? e.message : "Could not update tenancy status";
    return { ok: false, error: message };
  }
}

export async function scheduleMoveOutInspectionAction(
  tenancyId: string,
  inspectionDate: string,
  notes?: string,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  const trimmedDate = inspectionDate.trim();
  if (!trimmedId) return { ok: false, error: "Invalid tenancy id" };
  if (!trimmedDate) return { ok: false, error: "Inspection date is required" };

  try {
    const ctx = await requireStaffContextFromSession();
    await scheduleMoveOutInspection(prisma, ctx, trimmedId, {
      inspectionDate: toDateOnlyUTC(trimmedDate),
      notes: notes?.trim() || null,
    });
    revalidatePath("/leasing/tenancies");
    revalidatePath("/leasing/offboarding");
    revalidatePath(`/leasing/tenancies/${trimmedId}`);

    revalidatePath("/operations");
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
    const message = e instanceof Error ? e.message : "Could not schedule inspection";
    return { ok: false, error: message };
  }
}

export async function completeMoveOutInspectionAction(
  tenancyId: string,
  inspectionDate: string,
  reportUrl?: string,
  notes?: string,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  const trimmedDate = inspectionDate.trim();
  if (!trimmedId) return { ok: false, error: "Invalid tenancy id" };
  if (!trimmedDate) return { ok: false, error: "Inspection date is required" };

  try {
    const ctx = await requireStaffContextFromSession();
    await completeMoveOutInspection(prisma, ctx, trimmedId, {
      inspectionDate: toDateOnlyUTC(trimmedDate),
      reportUrl: reportUrl?.trim() || null,
      notes: notes?.trim() || null,
    });
    revalidatePath("/leasing/tenancies");
    revalidatePath("/leasing/offboarding");
    revalidatePath(`/leasing/tenancies/${trimmedId}`);

    revalidatePath("/operations");
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
    const message = e instanceof Error ? e.message : "Could not complete inspection";
    return { ok: false, error: message };
  }
}

export async function updateLeaseSetupAction(
  tenancyId: string,
  formData: unknown,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid tenancy id" };
  }

  const parsed = parseLeaseSetupFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const raw = formData as Record<string, unknown>;
    const leaseEndDate =
      typeof raw.leaseEndDate === "string" && raw.leaseEndDate.trim()
        ? toDateOnlyUTC(raw.leaseEndDate.trim())
        : null;

    let petDeposit: number | null | undefined;
    if (raw.petDeposit !== undefined && raw.petDeposit !== null && raw.petDeposit !== "") {
      const n = typeof raw.petDeposit === "number" ? raw.petDeposit : Number(raw.petDeposit);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "Pet deposit must be a non-negative number" };
      }
      petDeposit = n;
    }

    await updateTenancy(prisma, ctx, trimmedId, {
      leaseSetupJson: leaseSetupFormToJson(parsed),
      leaseEndDate: parsed.tenancyType === "fixed_term" ? leaseEndDate : null,
      ...(petDeposit !== undefined ? { petDeposit } : {}),
    });

    revalidatePath("/leasing/tenancies");
    revalidatePath(`/leasing/tenancies/${trimmedId}`);

    revalidatePath("/operations");
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
    const message = e instanceof Error ? e.message : "Could not save lease setup";
    return { ok: false, error: message };
  }
}

export async function generateRtb1DraftAction(
  tenancyId: string,
): Promise<GenerateRtb1DraftResult> {
  const trimmedId = tenancyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid tenancy id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const document = await generateRtb1DraftForTenancy(prisma, ctx, trimmedId);
    revalidatePath("/leasing/tenancies");
    revalidatePath(`/leasing/tenancies/${trimmedId}`);

    revalidatePath("/operations");
    return { ok: true, documentId: document.id };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof Rtb1GenerationNotReadyError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof Rtb1DraftBlockedDuringSigningError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not generate RTB-1 draft";
    return { ok: false, error: message };
  }
}

export async function sendLeaseForSignatureAction(
  tenancyId: string,
  draftDocumentId?: string,
): Promise<SendLeaseForSignatureResult> {
  const trimmedId = tenancyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid tenancy id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const result = await sendLeaseForSignature(
      prisma,
      ctx,
      trimmedId,
      draftDocumentId?.trim() || undefined,
    );

    let emailWarning: string | undefined;
    const recipient = await loadLeaseSigningEmailRecipient(prisma, trimmedId);
    if (recipient) {
      try {
        await sendLeaseSigningRequestEmail({
          to: recipient.email,
          tenantName: recipient.tenantName,
          propertyName: recipient.propertyName,
          unitLabel: recipient.unitLabel,
          signingPath: result.signingUrl,
          expiresAt: leaseSigningTokenExpiresAt(),
        });
      } catch (emailError) {
        console.error("[sendLeaseForSignatureAction] lease signing email failed", emailError);
        emailWarning =
          "The signature request was created, but the tenant email could not be sent. Copy the signing link below and send it manually.";
      }
    } else {
      emailWarning =
        "The signature request was created, but no tenant email was found. Copy the signing link below and send it manually.";
    }

    revalidatePath(`/leasing/tenancies/${trimmedId}`);

    revalidatePath("/operations");
    return {
      ok: true,
      signatureRequestId: result.signatureRequestId,
      signingUrl: result.signingUrl,
      ...(emailWarning ? { emailWarning } : {}),
    };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof LeaseSigningError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not send for signature";
    return { ok: false, error: message };
  }
}

export async function refreshLeaseSigningLinkAction(
  signatureRequestId: string,
): Promise<SendLeaseForSignatureResult> {
  const trimmedId = signatureRequestId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid signature request id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const result = await refreshLeaseSigningLink(prisma, ctx, trimmedId);
    const request = await prisma.signatureRequest.findUnique({
      where: { id: trimmedId },
      select: { tenancyId: true },
    });
    if (request?.tenancyId) {
      revalidatePath(`/leasing/tenancies/${request.tenancyId}`);

    revalidatePath("/operations");
    }
    return {
      ok: true,
      signatureRequestId: result.signatureRequestId,
      signingUrl: result.signingUrl,
    };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof LeaseSigningError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not refresh signing link";
    return { ok: false, error: message };
  }
}

export async function submitPmLeaseSignatureAction(
  signatureRequestId: string,
  input: {
    signerName: string;
    acknowledgedReview: boolean;
    signatureDataUrl: string;
  },
): Promise<TenancyActionResult> {
  const trimmedId = signatureRequestId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid signature request id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const { headers } = await import("next/headers");
    const hdrs = await headers();
    const audit = clientIpFromHeaders(hdrs.get("x-forwarded-for"), hdrs.get("user-agent"));

    const document = await submitPmLeaseSignature(prisma, ctx, trimmedId, {
      ...input,
      ...audit,
    });
    revalidatePath(`/leasing/tenancies/${document.tenancyId ?? ""}`);

    revalidatePath("/operations");
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof LeaseSigningError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not submit signature";
    return { ok: false, error: message };
  }
}

export async function retryLeaseExecutionAction(
  signatureRequestId: string,
): Promise<TenancyActionResult> {
  const trimmedId = signatureRequestId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid signature request id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const document = await submitPmLeaseSignature(prisma, ctx, trimmedId, {
      signerName: "",
      acknowledgedReview: true,
      signatureDataUrl: "",
    });
    revalidatePath(`/leasing/tenancies/${document.tenancyId ?? ""}`);

    revalidatePath("/operations");
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof LeaseSigningError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof NotFoundError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not complete lease execution";
    return { ok: false, error: message };
  }
}

export async function setTenancyContactPortalAccessAction(
  contactId: string,
  enabled: boolean,
): Promise<TenancyActionResult> {
  const trimmedId = contactId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid contact id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const contact = await updateTenancyContact(prisma, ctx, trimmedId, {
      portalAccessEnabled: enabled,
    });
    revalidatePath("/leasing/tenancies");
    revalidatePath(`/leasing/tenancies/${contact.tenancyId}`);

    revalidatePath("/operations");
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
    const message = e instanceof Error ? e.message : "Could not update portal access";
    return { ok: false, error: message };
  }
}

export async function updateTenancyDetailsAction(
  tenancyId: string,
  formData: unknown,
): Promise<TenancyActionResult> {
  const trimmedId = tenancyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid tenancy id" };
  }

  const parsed = parseTenancyEditFormInput(formData);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const { propertyId } = await applyTenancyDetailsUpdate(prisma, ctx, trimmedId, parsed);
    revalidatePath("/properties/health");
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath("/leasing/tenancies");
    revalidatePath(`/leasing/tenancies/${trimmedId}`);

    revalidatePath("/operations");
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
    const message = e instanceof Error ? e.message : "Could not save tenancy details";
    return { ok: false, error: message };
  }
}

export async function resolveNextHealthCleanupTenancyAction(
  currentTenancyId: string,
  healthFiltersRaw: string,
): Promise<{ ok: true; nextTenancyId: string | null } | { ok: false; error: string }> {
  const trimmedId = currentTenancyId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Invalid tenancy id" };
  }

  try {
    const ctx = await requireStaffContextFromSession();
    const filters = parseCleanupFiltersParam(healthFiltersRaw);
    const { rows } = await loadPortfolioHealthForStaff(ctx);
    const filteredRows = filterPortfolioHealthCleanupQueue(rows, filters);
    const queue = flattenHealthCleanupTenancyQueue(filteredRows);
    const next = selectNextTenancyInCleanupQueue(queue, trimmedId);
    return { ok: true, nextTenancyId: next?.tenancyId ?? null };
  } catch (e) {
    if (e instanceof StaffAuthError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not resolve next cleanup tenancy";
    return { ok: false, error: message };
  }
}
