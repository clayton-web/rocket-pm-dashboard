import { auth } from "@/auth";
import { PropertyDetail, type PropertyDetailData } from "@/components/properties/property-detail";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import prisma from "@/lib/db/prisma";
import { safeResolvePropertyDetailMarketRentResearch } from "@/lib/market-rent-research/access";
import { loadRentalListingsForPropertyStaff } from "@/lib/leasing/rental-listing-staff";
import { loadPropertyDocumentsForStaff } from "@/lib/property/property-documents-staff";
import { loadPropertyPlacementsForStaff } from "@/lib/property/property-placements-staff";
import { loadPropertyTenanciesForStaff } from "@/lib/property/property-tenancies-staff";
import { propertyProfileFromRecord } from "@/lib/property/profile";
import { isPropertyServiceRelationship } from "@/lib/property/service-relationship";
import { hasOrgWidePropertyRights } from "@/lib/services/property-access";
import { getPropertyById } from "@/lib/services/property.service";
import { listUnitsForProperty } from "@/lib/services/unit.service";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ propertyId: string }>;
};

function canManagePropertyUnits(
  ctx: NonNullable<Awaited<ReturnType<typeof getStaffContextFromSession>>>,
  propertyId: string,
): boolean {
  if (hasOrgWidePropertyRights(ctx)) return true;
  const roles = ctx.assignmentRolesByProperty.get(propertyId);
  return Boolean(roles?.has("property_manager"));
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { propertyId } = await params;
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <PropertyDetail
        detail={null}
        canAddUnit={false}
        canDeleteProperty={false}
        loadError="Select an active organization to view this property."
      />
    );
  }

  try {
    const [property, units] = await Promise.all([
      getPropertyById(prisma, ctx, propertyId),
      listUnitsForProperty(prisma, ctx, propertyId),
    ]);

    let documents = null;
    let documentsLoadError: string | null = null;
    try {
      documents = await loadPropertyDocumentsForStaff(prisma, ctx, propertyId);
    } catch (e) {
      documentsLoadError = e instanceof Error ? e.message : "Could not load documents.";
    }

    const unitInputs = units.map((unit) => ({
      id: unit.id,
      unitNumber: unit.unitNumber,
      floor: unit.floor,
      bedrooms: unit.bedrooms,
      isActive: unit.isActive,
    }));

    let tenancies = null;
    let tenanciesLoadError: string | null = null;
    try {
      tenancies = await loadPropertyTenanciesForStaff(prisma, ctx, propertyId, unitInputs);
    } catch (e) {
      tenanciesLoadError = e instanceof Error ? e.message : "Could not load tenancies.";
    }

    let rentalListings = null;
    let rentalListingsLoadError: string | null = null;
    try {
      rentalListings = await loadRentalListingsForPropertyStaff(prisma, ctx, propertyId, unitInputs);
    } catch (e) {
      rentalListingsLoadError = e instanceof Error ? e.message : "Could not load rental listings.";
    }

    let placements: Awaited<ReturnType<typeof loadPropertyPlacementsForStaff>> | null = null;
    let placementsLoadError: string | null = null;
    try {
      placements = await loadPropertyPlacementsForStaff(prisma, ctx, propertyId, unitInputs);
    } catch (e) {
      if (e instanceof ForbiddenError) {
        placements = [];
      } else {
        placementsLoadError = e instanceof Error ? e.message : "Could not load placements.";
      }
    }

    const serviceRelationship = isPropertyServiceRelationship(property.serviceRelationship)
      ? property.serviceRelationship
      : "MANAGED";

    const detail: PropertyDetailData = {
      id: property.id,
      name: property.name,
      streetLine1: property.streetLine1,
      streetLine2: property.streetLine2,
      city: property.city,
      province: property.province,
      postalCode: property.postalCode,
      country: property.country,
      isActive: property.isActive,
      serviceRelationship,
      ownerEmail: property.ownerEmail,
      ownerPhone: property.ownerPhone,
      strataNotes: property.strataNotes,
      profile: propertyProfileFromRecord(property),
      units: unitInputs,
      documents,
      documentsLoadError,
      tenancies,
      tenanciesLoadError,
      rentalListings,
      rentalListingsLoadError,
      placements,
      placementsLoadError,
    };

    const canManageProperty = canManagePropertyUnits(ctx, propertyId);
    const marketRentResearch = safeResolvePropertyDetailMarketRentResearch({
      canManagePropertyUnits: canManageProperty,
    });

    return (
      <PropertyDetail
        detail={detail}
        canAddUnit={canManageProperty}
        canDeleteProperty={canManageProperty}
        loadError={null}
        marketRentResearch={marketRentResearch}
      />
    );
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) {
      return (
        <PropertyDetail detail={null} canAddUnit={false} canDeleteProperty={false} loadError={e.message} />
      );
    }
    return (
      <PropertyDetail
        detail={null}
        canAddUnit={false}
        canDeleteProperty={false}
        loadError="Could not load property."
      />
    );
  }
}
