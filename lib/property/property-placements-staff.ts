import type { PrismaClient } from "@prisma/client";
import { requirePropertyManagerAccess, requireStaff } from "@/lib/services/property-access";
import type { StaffContext } from "@/lib/services/staff-context";

export type PropertyPlacementHistoryRow = {
  id: string;
  applicationId: string;
  unitLabel: string;
  completedAt: string;
  leaseStartDate: string;
  monthlyRent: string;
  applicantName: string;
  listingHeadline: string | null;
  listingClosed: boolean;
};

export async function loadPropertyPlacementsForStaff(
  prisma: PrismaClient,
  ctx: StaffContext,
  propertyId: string,
  units: { id: string; unitNumber: string }[],
): Promise<PropertyPlacementHistoryRow[]> {
  requireStaff(ctx);
  await requirePropertyManagerAccess(prisma, ctx, propertyId);

  const placements = await prisma.tenantPlacement.findMany({
    where: { propertyId, status: "completed" },
    orderBy: { completedAt: "desc" },
    take: 20,
    include: {
      application: {
        select: { firstName: true, lastName: true, email: true },
      },
      rentalListing: {
        select: { headline: true },
      },
    },
  });

  const unitById = new Map(units.map((u) => [u.id, u.unitNumber]));

  return placements.map((p) => {
    const name = [p.application.firstName, p.application.lastName].filter(Boolean).join(" ").trim();
    return {
      id: p.id,
      applicationId: p.applicationId,
      unitLabel: unitById.get(p.unitId) ?? "—",
      completedAt: p.completedAt.toISOString(),
      leaseStartDate: p.leaseStartDate.toISOString().slice(0, 10),
      monthlyRent: p.monthlyRent.toString(),
      applicantName: name || p.application.email,
      listingHeadline: p.rentalListing?.headline ?? null,
      listingClosed: p.rentalListingClosed,
    };
  });
}
