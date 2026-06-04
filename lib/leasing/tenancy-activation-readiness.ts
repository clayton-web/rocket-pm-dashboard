import { RTB1_EXECUTED_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";

export type ExecutedLeaseDocumentSummary = {
  id: string;
  documentType: string;
  isSigned: boolean;
  isLocked: boolean;
};

export type TenancyActivationReadiness = {
  ready: boolean;
  reason: string;
  executedDocumentId: string | null;
};

/**
 * Determines whether a tenancy has a locked executed RTB-1 suitable for activation.
 * Staff override is reserved for a future PR-C4 UI flag.
 */
export function assessTenancyActivationReadiness(opts: {
  executedDocuments: ExecutedLeaseDocumentSummary[];
  staffOverride?: boolean;
}): TenancyActivationReadiness {
  if (opts.staffOverride === true) {
    return {
      ready: true,
      reason: "Staff override (not yet implemented in UI)",
      executedDocumentId: null,
    };
  }

  const executed = opts.executedDocuments.find(
    (doc) =>
      doc.documentType === RTB1_EXECUTED_DOCUMENT_TYPE && doc.isSigned === true && doc.isLocked === true,
  );

  if (executed) {
    return {
      ready: true,
      reason: "Executed RTB-1 is on file",
      executedDocumentId: executed.id,
    };
  }

  return {
    ready: false,
    reason: "An executed, locked RTB-1 is required before tenant activation",
    executedDocumentId: null,
  };
}
