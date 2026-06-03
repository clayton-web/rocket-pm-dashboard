import { auth } from "@/auth";
import { ApplicationDetail } from "@/components/leasing/application-detail";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getApplicationDetailForStaff } from "@/lib/leasing/application-staff-detail";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeasingApplicationDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <ApplicationDetail
        initialDetail={null}
        loadError="Select an active organization to view this application."
      />
    );
  }

  try {
    const detail = await getApplicationDetailForStaff(ctx, id);
    return <ApplicationDetail initialDetail={detail} loadError={null} />;
  } catch (e) {
    if (e instanceof NotFoundError) {
      return <ApplicationDetail initialDetail={null} loadError="Application not found." />;
    }
    if (e instanceof ForbiddenError) {
      return (
        <ApplicationDetail initialDetail={null} loadError="You do not have access to this application." />
      );
    }
    return <ApplicationDetail initialDetail={null} loadError="Could not load application." />;
  }
}
