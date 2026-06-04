import type { PrismaClient } from "@prisma/client";
import type { TenancyStatus } from "@prisma/client";
import { RTB1_EXECUTED_DOCUMENT_TYPE } from "@/lib/leasing/rtb1/constants";
import {
  assessTenancyActivationReadiness,
  type TenancyActivationReadiness,
} from "@/lib/leasing/tenancy-activation-readiness";

export async function loadTenancyActivationReadiness(
  prisma: PrismaClient,
  tenancyId: string,
): Promise<TenancyActivationReadiness> {
  const documents = await prisma.document.findMany({
    where: {
      tenancyId,
      documentType: RTB1_EXECUTED_DOCUMENT_TYPE,
    },
    select: {
      id: true,
      documentType: true,
      isSigned: true,
      isLocked: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return assessTenancyActivationReadiness({ executedDocuments: documents });
}

/** Returns a staff-facing error when activation must be blocked, otherwise null. */
export function activationBlockReasonForAdvance(
  current: TenancyStatus,
  next: TenancyStatus,
  readiness: TenancyActivationReadiness,
): string | null {
  if (current === "pending_move_in" && next === "active" && !readiness.ready) {
    return readiness.reason;
  }
  return null;
}
