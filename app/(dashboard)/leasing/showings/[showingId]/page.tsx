import { auth } from "@/auth";
import { ShowingDetail } from "@/components/leasing/showing-detail";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getShowingDetailForStaff } from "@/lib/leasing/showing-staff-detail";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ showingId: string }>;
};

export default async function LeasingShowingDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { showingId } = await params;
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <ShowingDetail
        initialDetail={null}
        loadError="Select an active organization to view this showing."
      />
    );
  }

  try {
    const detail = await getShowingDetailForStaff(ctx, showingId);
    return <ShowingDetail initialDetail={detail} loadError={null} />;
  } catch (e) {
    if (e instanceof NotFoundError) {
      return <ShowingDetail initialDetail={null} loadError="Showing not found." />;
    }
    if (e instanceof ForbiddenError) {
      return (
        <ShowingDetail initialDetail={null} loadError="You do not have access to this showing." />
      );
    }
    return <ShowingDetail initialDetail={null} loadError="Could not load showing." />;
  }
}
