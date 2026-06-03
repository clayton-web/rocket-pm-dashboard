import { auth } from "@/auth";
import { ApplicationQueueList } from "@/components/leasing/application-queue-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { listApplicationQueueForStaff } from "@/lib/leasing/application-staff-queue";
import { redirect } from "next/navigation";

export default async function LeasingApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <ApplicationQueueList
        initialApplications={[]}
        loadError="Select an active organization to view applications."
      />
    );
  }

  try {
    const rows = await listApplicationQueueForStaff(ctx);
    return <ApplicationQueueList initialApplications={rows} loadError={null} />;
  } catch {
    return (
      <ApplicationQueueList
        initialApplications={[]}
        loadError="Could not load applications."
      />
    );
  }
}
