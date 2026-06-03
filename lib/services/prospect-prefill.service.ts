import type { PrismaClient } from "@prisma/client";
import {
  findProspectForApplicationMatch,
  type ProspectApplicationMatchInput,
} from "@/lib/leasing/prospect-match";
import {
  toPublicProspectPrefillResponse,
  type PublicProspectPrefillResponse,
} from "@/lib/leasing/prospect-prefill";

export async function lookupProspectPrefillForApplication(
  prisma: PrismaClient,
  input: ProspectApplicationMatchInput,
): Promise<PublicProspectPrefillResponse> {
  const prospect = await findProspectForApplicationMatch(prisma, input);
  return toPublicProspectPrefillResponse(prospect);
}
