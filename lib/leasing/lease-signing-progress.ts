import type { LeaseSignature, SignatureRequest, SignatureRequestStatus } from "@prisma/client";
import { RTB1_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";

export type LeaseSigningStepId =
  | "draft_generated"
  | "signature_sent"
  | "tenant_signed"
  | "pm_signed"
  | "executed";

export type LeaseSigningStep = {
  id: LeaseSigningStepId;
  label: string;
  complete: boolean;
  timestamp: string | null;
};

export type LeaseSigningProgress = {
  steps: LeaseSigningStep[];
  signatureRequestId: string | null;
  signingUrl: string | null;
  tenantSignedAt: string | null;
  pmSignedAt: string | null;
  executedDocumentId: string | null;
  executedDownloadHref: string | null;
  canSendForSignature: boolean;
  canPmSign: boolean;
  statusLabel: string;
};

type DraftDocumentSummary = {
  id: string;
  createdAt: Date;
  documentType: string;
  isLocked: boolean;
};

type SignatureRequestSummary = Pick<
  SignatureRequest,
  "id" | "status" | "sentAt" | "completedAt" | "executedDocumentId" | "signingTokenHash"
> & {
  signatures: Pick<LeaseSignature, "signerRole" | "signedAt">[];
};

const ACTIVE_SIGNATURE_STATUSES: SignatureRequestStatus[] = ["draft", "sent", "viewed"];

export function isActiveLeaseSignatureRequest(status: SignatureRequestStatus): boolean {
  return ACTIVE_SIGNATURE_STATUSES.includes(status);
}

export function deriveLeaseSigningProgress(args: {
  latestDraft: DraftDocumentSummary | null;
  signatureRequest: SignatureRequestSummary | null;
  executedDocument: { id: string; createdAt: Date } | null;
  readinessComplete: boolean;
  signingToken?: string | null;
}): LeaseSigningProgress {
  const tenantSig = args.signatureRequest?.signatures.find((s) => s.signerRole === "tenant");
  const pmSig = args.signatureRequest?.signatures.find((s) => s.signerRole === "property_manager");

  const draftGenerated = args.latestDraft != null && args.latestDraft.documentType === RTB1_DOCUMENT_TYPE;
  const signatureSent =
    args.signatureRequest != null &&
    args.signatureRequest.sentAt != null &&
    isActiveLeaseSignatureRequest(args.signatureRequest.status);
  const tenantSigned = tenantSig != null;
  const pmSigned = pmSig != null;
  const executed =
    args.executedDocument != null ||
    (args.signatureRequest?.status === "completed" && args.signatureRequest.executedDocumentId != null);

  const steps: LeaseSigningStep[] = [
    {
      id: "draft_generated",
      label: "Draft Generated",
      complete: draftGenerated,
      timestamp: args.latestDraft?.createdAt.toISOString() ?? null,
    },
    {
      id: "signature_sent",
      label: "Signature Sent",
      complete: signatureSent || tenantSigned || pmSigned || executed,
      timestamp: args.signatureRequest?.sentAt?.toISOString() ?? null,
    },
    {
      id: "tenant_signed",
      label: "Tenant Signed",
      complete: tenantSigned || pmSigned || executed,
      timestamp: tenantSig?.signedAt.toISOString() ?? null,
    },
    {
      id: "pm_signed",
      label: "PM Signed",
      complete: pmSigned || executed,
      timestamp: pmSig?.signedAt.toISOString() ?? null,
    },
    {
      id: "executed",
      label: "Executed",
      complete: executed,
      timestamp: args.executedDocument?.createdAt.toISOString() ?? args.signatureRequest?.completedAt?.toISOString() ?? null,
    },
  ];

  const hasActiveRequest =
    args.signatureRequest != null && isActiveLeaseSignatureRequest(args.signatureRequest.status);

  const canSendForSignature =
    draftGenerated &&
    args.readinessComplete &&
    !hasActiveRequest &&
    !executed &&
    args.latestDraft != null &&
    !args.latestDraft.isLocked;

  const canPmSign =
    hasActiveRequest &&
    tenantSigned &&
    !pmSigned &&
    !executed &&
    args.signatureRequest != null;

  const signingUrl =
    args.signingToken && args.signatureRequest?.signingTokenHash
      ? `/sign/lease/${args.signingToken}`
      : null;

  let statusLabel = "Awaiting RTB-1 draft";
  if (executed) statusLabel = "Executed";
  else if (pmSigned) statusLabel = "Generating executed agreement…";
  else if (tenantSigned) statusLabel = "Awaiting property manager signature";
  else if (signatureSent) statusLabel = "Awaiting tenant signature";
  else if (draftGenerated) statusLabel = "Ready to send for signature";

  const executedDocumentId =
    args.executedDocument?.id ?? args.signatureRequest?.executedDocumentId ?? null;

  return {
    steps,
    signatureRequestId: args.signatureRequest?.id ?? null,
    signingUrl,
    tenantSignedAt: tenantSig?.signedAt.toISOString() ?? null,
    pmSignedAt: pmSig?.signedAt.toISOString() ?? null,
    executedDocumentId,
    executedDownloadHref: executedDocumentId
      ? `/api/leasing/documents/${executedDocumentId}/download`
      : null,
    canSendForSignature,
    canPmSign,
    statusLabel,
  };
}

export function assertLeaseSigningTransition(args: {
  hasTenantSignature: boolean;
  hasPmSignature: boolean;
  target: "tenant" | "property_manager";
}): void {
  if (args.target === "tenant" && args.hasTenantSignature) {
    throw new Error("Tenant has already signed this lease");
  }
  if (args.target === "property_manager") {
    if (!args.hasTenantSignature) {
      throw new Error("Tenant must sign before the property manager can counter-sign");
    }
    if (args.hasPmSignature) {
      throw new Error("Property manager has already signed this lease");
    }
  }
}
