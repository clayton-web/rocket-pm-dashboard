import { auth } from "@/auth";
import { ProspectDetail } from "@/components/leasing/prospect-detail";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getProspectDetailForStaff } from "@/lib/leasing/prospect-staff-detail";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function LeasingProspectDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { prospectId } = await params;
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <ProspectDetail
        initialDetail={null}
        loadError="Select an active organization to view this prospect."
      />
    );
  }

  try {
    const detail = await getProspectDetailForStaff(ctx, prospectId);
    return <ProspectDetail initialDetail={detail} loadError={null} />;
  } catch (e) {
    if (e instanceof NotFoundError) {
      return <ProspectDetail initialDetail={null} loadError="Prospect not found." />;
    }
    if (e instanceof ForbiddenError) {
      return (
        <ProspectDetail initialDetail={null} loadError="You do not have access to this prospect." />
      );
    }
    return <ProspectDetail initialDetail={null} loadError="Could not load prospect." />;
  }
}
