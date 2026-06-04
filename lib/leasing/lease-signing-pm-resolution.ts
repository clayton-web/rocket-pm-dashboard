export type PmSigningResolution =
  | { action: "create_signature_and_execute" }
  | { action: "execute_only" }
  | { action: "return_existing"; executedDocumentId: string };

export function resolvePmLeaseSigningAction(args: {
  hasTenantSignature: boolean;
  hasPmSignature: boolean;
  executedDocumentId: string | null;
  status: string;
}): PmSigningResolution {
  if (args.executedDocumentId && args.status === "completed") {
    return { action: "return_existing", executedDocumentId: args.executedDocumentId };
  }
  if (!args.hasTenantSignature) {
    throw new Error("Tenant must sign before the property manager can counter-sign");
  }
  if (args.hasPmSignature && !args.executedDocumentId) {
    return { action: "execute_only" };
  }
  if (args.hasPmSignature) {
    return { action: "return_existing", executedDocumentId: args.executedDocumentId! };
  }
  return { action: "create_signature_and_execute" };
}
