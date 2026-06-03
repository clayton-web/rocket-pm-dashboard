import type { PrismaClient, Prospect } from "@prisma/client";
import { normalizeApplicationEmail } from "@/lib/leasing/application-email";

export type ProspectApplicationMatchInput = {
  propertyId: string;
  unitId: string;
  email: string;
};

/** Prospect unit is unset (any unit) or matches the application unit. */
export function prospectMatchesApplicationUnit(
  prospect: Pick<Prospect, "unitId">,
  applicationUnitId: string,
): boolean {
  if (!prospect.unitId) return true;
  return prospect.unitId === applicationUnitId;
}

/**
 * Latest non-archived prospect for public application prefill / linking.
 * Queries Prospect only — never Application.
 */
export async function findProspectForApplicationMatch(
  prisma: PrismaClient,
  input: ProspectApplicationMatchInput,
): Promise<Prospect | null> {
  const email = normalizeApplicationEmail(input.email);
  const prospects = await prisma.prospect.findMany({
    where: {
      propertyId: input.propertyId,
      email,
      status: "new",
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return prospects.find((p) => prospectMatchesApplicationUnit(p, input.unitId)) ?? null;
}

export type AssertProspectForApplicationStartInput = ProspectApplicationMatchInput & {
  prospectId: string;
};

/**
 * Revalidates a client-supplied prospectId on application start (email, property, unit, status).
 */
export async function assertProspectForApplicationStart(
  prisma: PrismaClient,
  input: AssertProspectForApplicationStartInput,
): Promise<Prospect> {
  const prospect = await prisma.prospect.findUnique({ where: { id: input.prospectId } });
  if (!prospect || prospect.status !== "new") {
    throw new Error("Prospect not found");
  }
  if (prospect.propertyId !== input.propertyId) {
    throw new Error("Prospect not found");
  }
  if (normalizeApplicationEmail(prospect.email) !== normalizeApplicationEmail(input.email)) {
    throw new Error("Prospect not found");
  }
  if (!prospectMatchesApplicationUnit(prospect, input.unitId)) {
    throw new Error("Prospect not found");
  }
  return prospect;
}
