/**
 * Market Rent Research action handlers — reference tool only.
 * Does not write to Tenancy, Property, Unit, Application, lease/RTB-1, or portal records.
 * PR 1: validates access and inputs; no scraping, OpenAI, or persistence.
 */
import type { PrismaClient } from "@prisma/client";
import { parseMarketRentResearchInputs } from "@/lib/validation/market-rent-research";
import {
  ForbiddenError,
  hasOrgWidePropertyRights,
  requirePropertyAccess,
  requirePropertyManagerAccess,
  requireStaff,
} from "@/lib/services/property-access";
import { NotFoundError } from "@/lib/services/errors";
import type { StaffContext } from "@/lib/services/staff-context";
import { MARKET_RENT_RESEARCH_NOT_IMPLEMENTED_MESSAGE } from "./constants";
import type { MarketRentResearchActionResult } from "./types";

async function getUnitPropertyId(
  prisma: PrismaClient,
  principal: StaffContext,
  unitId: string,
): Promise<string> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      propertyId: true,
      property: { select: { id: true, organizationId: true } },
    },
  });
  if (!unit) throw new NotFoundError("Unit not found");
  if (unit.property.organizationId !== principal.organizationId) {
    throw new ForbiddenError("No access to this unit");
  }
  return unit.propertyId;
}

async function requireResearchEditorAccess(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
): Promise<void> {
  requireStaff(principal);
  if (hasOrgWidePropertyRights(principal)) {
    await requirePropertyAccess(prisma, principal, propertyId);
    return;
  }
  await requirePropertyManagerAccess(prisma, principal, propertyId);
}

export async function handleRunMarketRentResearch(
  prisma: PrismaClient,
  principal: StaffContext,
  args: {
    unitId: string;
    inputs: unknown;
  },
): Promise<MarketRentResearchActionResult> {
  const trimmedUnitId = args.unitId.trim();
  if (!trimmedUnitId) return { ok: false, error: "Unit is required." };

  const parsedInputs = parseMarketRentResearchInputs(args.inputs);
  if ("error" in parsedInputs) return { ok: false, error: parsedInputs.error };

  const propertyId = await getUnitPropertyId(prisma, principal, trimmedUnitId);
  await requireResearchEditorAccess(prisma, principal, propertyId);

  return {
    ok: true,
    status: "not_implemented",
    message: MARKET_RENT_RESEARCH_NOT_IMPLEMENTED_MESSAGE,
  };
}
