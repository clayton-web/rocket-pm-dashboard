import { auth } from "@/auth";
import { LeasingDashboard } from "@/components/leasing/leasing-dashboard";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getLeasingDashboardForStaff } from "@/lib/leasing/leasing-dashboard.service";
import { redirect } from "next/navigation";

export default async function LeasingDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return <LeasingDashboard data={null} loadError="Select an active organization to view leasing." />;
  }

  try {
    const data = await getLeasingDashboardForStaff(ctx);
    return <LeasingDashboard data={data} loadError={null} />;
  } catch {
    return <LeasingDashboard data={null} loadError="Could not load leasing dashboard." />;
  }
}
