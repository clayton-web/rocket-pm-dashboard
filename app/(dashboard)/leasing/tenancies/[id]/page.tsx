import { auth } from "@/auth";
import { TenancyDetail } from "@/components/leasing/tenancy-detail";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getTenancyDetailForStaff } from "@/lib/leasing/tenancy-staff-detail";
import { parseHealthCleanupContext } from "@/lib/property/portfolio-health-return";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeasingTenancyDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const query = await searchParams;
  const healthCleanupContext = parseHealthCleanupContext(query);
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <TenancyDetail
        initialDetail={null}
        loadError="Select an active organization to view this tenancy."
        healthCleanupContext={healthCleanupContext}
      />
    );
  }

  try {
    const detail = await getTenancyDetailForStaff(ctx, id);
    return <TenancyDetail initialDetail={detail} loadError={null} healthCleanupContext={healthCleanupContext} />;
  } catch (e) {
    if (e instanceof NotFoundError) {
      return <TenancyDetail initialDetail={null} loadError="Tenancy not found." />;
    }
    if (e instanceof ForbiddenError) {
      return (
        <TenancyDetail initialDetail={null} loadError="You do not have access to this tenancy." />
      );
    }
    return <TenancyDetail initialDetail={null} loadError="Could not load tenancy." />;
  }
}
