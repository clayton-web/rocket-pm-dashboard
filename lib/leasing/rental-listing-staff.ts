import type { PrismaClient, RentalListing, RentalListingStatus } from "@prisma/client";
import { formatRentalListingStatus } from "@/lib/leasing/rental-listing-status";
import { isEntirePropertyUnit } from "@/lib/property/entire-property-unit";
import { listRentalListingsForProperty } from "@/lib/services/rental-listing.service";
import type { StaffContext } from "@/lib/services/staff-context";

export type RentalListingStaffRow = {
  id: string;
  unitId: string;
  status: RentalListingStatus;
  statusLabel: string;
  monthlyRent: string | null;
  availableDate: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  approxSqft: number | null;
  headline: string | null;
  description: string | null;
  petPolicy: string | null;
  parkingDetails: string | null;
  utilitiesDetails: string | null;
  viewingInstructions: string | null;
  publishedAt: string | null;
  pausedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
};

export type RentalListingUnitStaffRow = {
  unitId: string;
  unitNumber: string;
  unitLabel: string;
  isEntireProperty: boolean;
  isActive: boolean;
  openListing: RentalListingStaffRow | null;
  closedListings: RentalListingStaffRow[];
};

export type RentalListingsPropertyStaffData = {
  units: RentalListingUnitStaffRow[];
};

function formatDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function toStaffRow(listing: RentalListing): RentalListingStaffRow {
  return {
    id: listing.id,
    unitId: listing.unitId,
    status: listing.status,
    statusLabel: formatRentalListingStatus(listing.status),
    monthlyRent: listing.monthlyRent != null ? listing.monthlyRent.toString() : null,
    availableDate: formatDateOnly(listing.availableDate),
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms != null ? listing.bathrooms.toString() : null,
    approxSqft: listing.approxSqft,
    headline: listing.headline,
    description: listing.description,
    petPolicy: listing.petPolicy,
    parkingDetails: listing.parkingDetails,
    utilitiesDetails: listing.utilitiesDetails,
    viewingInstructions: listing.viewingInstructions,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    pausedAt: listing.pausedAt?.toISOString() ?? null,
    closedAt: listing.closedAt?.toISOString() ?? null,
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export async function loadRentalListingsForPropertyStaff(
  prisma: PrismaClient,
  principal: StaffContext,
  propertyId: string,
  units: { id: string; unitNumber: string; isActive: boolean }[],
): Promise<RentalListingsPropertyStaffData> {
  const listings = await listRentalListingsForProperty(prisma, principal, propertyId);
  const byUnit = new Map<string, RentalListing[]>();
  for (const listing of listings) {
    const list = byUnit.get(listing.unitId) ?? [];
    list.push(listing);
    byUnit.set(listing.unitId, list);
  }

  const unitRows: RentalListingUnitStaffRow[] = units.map((unit) => {
    const unitListings = byUnit.get(unit.id) ?? [];
    const open = unitListings.find((l) => l.status !== "CLOSED") ?? null;
    const closed = unitListings
      .filter((l) => l.status === "CLOSED")
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return {
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      unitLabel: isEntirePropertyUnit(unit.unitNumber) ? "Entire property" : unit.unitNumber,
      isEntireProperty: isEntirePropertyUnit(unit.unitNumber),
      isActive: unit.isActive,
      openListing: open ? toStaffRow(open) : null,
      closedListings: closed.map(toStaffRow),
    };
  });

  return { units: unitRows };
}
