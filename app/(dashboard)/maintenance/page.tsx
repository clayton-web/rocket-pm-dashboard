import { auth } from "@/auth";
import { MaintenanceManagerList } from "@/components/maintenance/maintenance-manager-list";
import { requireStaffMaintenanceContext } from "@/lib/maintenance/authorization";
import { listMaintenanceForStaff } from "@/lib/maintenance/maintenance.service";
import { redirect } from "next/navigation";

export default async function MaintenanceListPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await requireStaffMaintenanceContext();
  if (ctx instanceof Response) {
    return (
      <MaintenanceManagerList
        initialRequests={[]}
        loadError="Select an active organization to view maintenance requests."
      />
    );
  }

  try {
    const rows = await listMaintenanceForStaff(ctx);
    return <MaintenanceManagerList initialRequests={rows} loadError={null} />;
  } catch {
    return (
      <MaintenanceManagerList initialRequests={[]} loadError="Could not load maintenance requests." />
    );
  }
}
