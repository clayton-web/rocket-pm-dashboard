import { PDFDocument } from "pdf-lib";
import type { LeaseSignatureRole } from "@prisma/client";

export const RTB1_EXECUTION_PDF_FIELDS = {
  tenantSignatureLine: "last name first and middle names Signature Date TENANTSRow1",
  landlordSignatureLine: "last name first and middle names Signature DateRow1",
  agreementBindingDate:
    "By signing this tenancy agreement the landlord and the tenant are bound by its terms",
  tenantInitials: "Tenants Initials",
  landlordInitials: "landlords initials",
} as const;

export type Rtb1ExecutionSigner = {
  role: LeaseSignatureRole;
  signerName: string;
  signedAt: Date;
  signatureImagePng: Uint8Array;
};

export type ExecuteRtb1PdfInput = {
  draftPdfBytes: Uint8Array;
  signers: Rtb1ExecutionSigner[];
  vacateClauseApplies: boolean;
  landlordDisplayName: string;
};

function formatRtb1SignDate(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatSignatureLine(name: string, signedAt: Date): string {
  return `${name.trim()} — ${formatRtb1SignDate(signedAt)}`;
}

export function initialsFromSignerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function setTextField(form: ReturnType<PDFDocument["getForm"]>, fieldName: string, value: string): void {
  if (!value.trim()) return;
  try {
    form.getTextField(fieldName).setText(value);
  } catch {
    // Field may not exist in this template revision.
  }
}

/** Signature image placement on RTB-1 page 6 (0-indexed page 5). */
const SIGNATURE_IMAGE_LAYOUT: Record<
  LeaseSignatureRole,
  { x: number; y: number; width: number; height: number }
> = {
  tenant: { x: 145, y: 118, width: 160, height: 36 },
  property_manager: { x: 145, y: 58, width: 160, height: 36 },
};

export async function createExecutedRtb1Pdf(input: ExecuteRtb1PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.draftPdfBytes);
  const form = pdf.getForm();

  const tenant = input.signers.find((s) => s.role === "tenant");
  const landlord = input.signers.find((s) => s.role === "property_manager");
  const executionDate = landlord?.signedAt ?? tenant?.signedAt ?? new Date();

  if (tenant) {
    setTextField(
      form,
      RTB1_EXECUTION_PDF_FIELDS.tenantSignatureLine,
      formatSignatureLine(tenant.signerName, tenant.signedAt),
    );
  }
  if (landlord) {
    setTextField(
      form,
      RTB1_EXECUTION_PDF_FIELDS.landlordSignatureLine,
      formatSignatureLine(landlord.signerName, landlord.signedAt),
    );
  }

  setTextField(
    form,
    RTB1_EXECUTION_PDF_FIELDS.agreementBindingDate,
    formatRtb1SignDate(executionDate),
  );

  if (input.vacateClauseApplies) {
    if (tenant) {
      setTextField(form, RTB1_EXECUTION_PDF_FIELDS.tenantInitials, initialsFromSignerName(tenant.signerName));
    }
    setTextField(
      form,
      RTB1_EXECUTION_PDF_FIELDS.landlordInitials,
      initialsFromSignerName(landlord?.signerName ?? input.landlordDisplayName),
    );
  }

  const signaturePage = pdf.getPages()[5];
  for (const signer of input.signers) {
    const layout = SIGNATURE_IMAGE_LAYOUT[signer.role];
    const embedded = await pdf.embedPng(signer.signatureImagePng);
    signaturePage.drawImage(embedded, layout);
  }

  form.flatten();
  return pdf.save();
}
