import { auth } from "@/auth";
import { PropertyPortfolioHealth } from "@/components/properties/property-portfolio-health";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { loadPortfolioHealthForStaff } from "@/lib/property/portfolio-health-staff";
import { emptyPortfolioHealthSummary } from "@/lib/property/portfolio-health-metrics";
import { redirect } from "next/navigation";

import { Suspense } from "react";

export default async function PropertyPortfolioHealthPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <Suspense fallback={null}>
        <PropertyPortfolioHealth
          rows={[]}
          summary={emptyPortfolioHealthSummary()}
          loadError="Select an active organization to view portfolio health."
        />
      </Suspense>
    );
  }

  try {
    const { rows, summary } = await loadPortfolioHealthForStaff(ctx);
    return (
      <Suspense fallback={null}>
        <PropertyPortfolioHealth rows={rows} summary={summary} loadError={null} />
      </Suspense>
    );
  } catch {
    return (
      <Suspense fallback={null}>
        <PropertyPortfolioHealth
          rows={[]}
          summary={emptyPortfolioHealthSummary()}
          loadError="Could not load portfolio health."
        />
      </Suspense>
    );
  }
}
