import { auth } from "@/auth";
import { TenancyQueueList } from "@/components/leasing/tenancy-queue-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import {
  listPendingMoveInQueueForStaff,
  listTenancyQueueForStaff,
} from "@/lib/leasing/tenancy-staff-queue";
import { redirect } from "next/navigation";

export default async function LeasingTenanciesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { status } = await searchParams;
  const statusFilter = status === "pending_move_in" ? "pending_move_in" : "all";

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <TenancyQueueList
        statusFilter={statusFilter}
        initialTenancies={[]}
        loadError="Select an active organization to view tenancies."
      />
    );
  }

  try {
    const rows =
      statusFilter === "pending_move_in"
        ? await listPendingMoveInQueueForStaff(ctx)
        : await listTenancyQueueForStaff(ctx);
    return <TenancyQueueList statusFilter={statusFilter} initialTenancies={rows} loadError={null} />;
  } catch {
    return (
      <TenancyQueueList
        statusFilter={statusFilter}
        initialTenancies={[]}
        loadError="Could not load tenancies."
      />
    );
  }
}
