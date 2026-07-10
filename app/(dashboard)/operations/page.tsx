import { auth } from "@/auth";
import { OperationsCentre } from "@/components/operations/operations-centre";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getOperationsCentreForStaff } from "@/lib/operations/operations-centre.service";
import { redirect } from "next/navigation";

export default async function OperationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <OperationsCentre
        data={null}
        loadError="Select an active organization to view operations."
      />
    );
  }

  try {
    const data = await getOperationsCentreForStaff(ctx);
    return <OperationsCentre data={data} loadError={null} />;
  } catch {
    return (
      <OperationsCentre data={null} loadError="Could not load the operations centre." />
    );
  }
}
