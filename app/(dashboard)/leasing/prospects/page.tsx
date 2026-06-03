import { auth } from "@/auth";
import { ProspectQueueList } from "@/components/leasing/prospect-queue-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { listNewProspectQueueForStaff } from "@/lib/leasing/staff-queue";
import { redirect } from "next/navigation";

export default async function LeasingProspectsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <ProspectQueueList
        initialProspects={[]}
        loadError="Select an active organization to view viewing requests."
      />
    );
  }

  try {
    const rows = await listNewProspectQueueForStaff(ctx);
    return <ProspectQueueList initialProspects={rows} loadError={null} />;
  } catch {
    return (
      <ProspectQueueList initialProspects={[]} loadError="Could not load viewing requests." />
    );
  }
}
