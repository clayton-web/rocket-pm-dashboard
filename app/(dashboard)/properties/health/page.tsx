import { auth } from "@/auth";
import { PropertyPortfolioHealth } from "@/components/properties/property-portfolio-health";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { loadPortfolioHealthForStaff } from "@/lib/property/portfolio-health-staff";
import { redirect } from "next/navigation";

export default async function PropertyPortfolioHealthPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <PropertyPortfolioHealth
        rows={[]}
        summary={{
          total: 0,
          complete: 0,
          needsReview: 0,
          missingDocuments: 0,
          missingOwnerContact: 0,
          missingTenantInfo: 0,
          vacant: 0,
        }}
        loadError="Select an active organization to view portfolio health."
      />
    );
  }

  try {
    const { rows, summary } = await loadPortfolioHealthForStaff(ctx);
    return <PropertyPortfolioHealth rows={rows} summary={summary} loadError={null} />;
  } catch {
    return (
      <PropertyPortfolioHealth
        rows={[]}
        summary={{
          total: 0,
          complete: 0,
          needsReview: 0,
          missingDocuments: 0,
          missingOwnerContact: 0,
          missingTenantInfo: 0,
          vacant: 0,
        }}
        loadError="Could not load portfolio health."
      />
    );
  }
}
