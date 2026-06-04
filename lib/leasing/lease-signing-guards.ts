import type { PrismaClient, SignatureRequestStatus } from "@prisma/client";
import { LEASE_SIGNING_PROVIDER } from "@/lib/leasing/rtb1/constants";
import { isActiveLeaseSignatureRequest } from "@/lib/leasing/lease-signing-progress";

export class Rtb1DraftBlockedDuringSigningError extends Error {
  constructor() {
    super(
      "A lease signature request is in progress. Wait for tenant and property manager signing to finish before generating a new RTB-1 draft.",
    );
    this.name = "Rtb1DraftBlockedDuringSigningError";
  }
}

export async function findActiveLeaseSignatureRequestForTenancy(
  prisma: PrismaClient,
  tenancyId: string,
): Promise<{ id: string; status: SignatureRequestStatus } | null> {
  const row = await prisma.signatureRequest.findFirst({
    where: {
      tenancyId,
      provider: LEASE_SIGNING_PROVIDER,
      status: { in: ["draft", "sent", "viewed"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  return row;
}

export async function assertNoActiveLeaseSignatureRequest(
  prisma: PrismaClient,
  tenancyId: string,
): Promise<void> {
  const active = await findActiveLeaseSignatureRequestForTenancy(prisma, tenancyId);
  if (active && isActiveLeaseSignatureRequest(active.status)) {
    throw new Rtb1DraftBlockedDuringSigningError();
  }
}
