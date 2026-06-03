import { auth } from "@/auth";
import { TenancyQueueList } from "@/components/leasing/tenancy-queue-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { listTenancyQueueForStaff } from "@/lib/leasing/tenancy-staff-queue";
import { redirect } from "next/navigation";

export default async function LeasingTenanciesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <TenancyQueueList
        initialTenancies={[]}
        loadError="Select an active organization to view tenancies."
      />
    );
  }

  try {
    const rows = await listTenancyQueueForStaff(ctx);
    return <TenancyQueueList initialTenancies={rows} loadError={null} />;
  } catch {
    return (
      <TenancyQueueList initialTenancies={[]} loadError="Could not load tenancies." />
    );
  }
}
