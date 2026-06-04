import { auth } from "@/auth";
import { ApplicationQueueList } from "@/components/leasing/application-queue-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { listApprovedApplicationsReadyToConvertForStaff } from "@/lib/leasing/application-conversion-staff-queue";
import { listApplicationQueueForStaff } from "@/lib/leasing/application-staff-queue";
import { redirect } from "next/navigation";

export default async function LeasingApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { queue } = await searchParams;
  const isConversion = queue === "conversion";

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <ApplicationQueueList
        queueMode={isConversion ? "conversion" : "review"}
        initialApplications={[]}
        loadError="Select an active organization to view applications."
      />
    );
  }

  try {
    if (isConversion) {
      const rows = await listApprovedApplicationsReadyToConvertForStaff(ctx);
      return (
        <ApplicationQueueList queueMode="conversion" initialApplications={rows} loadError={null} />
      );
    }

    const rows = await listApplicationQueueForStaff(ctx);
    return <ApplicationQueueList queueMode="review" initialApplications={rows} loadError={null} />;
  } catch {
    return (
      <ApplicationQueueList
        queueMode={isConversion ? "conversion" : "review"}
        initialApplications={[]}
        loadError="Could not load applications."
      />
    );
  }
}
