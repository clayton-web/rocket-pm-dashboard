import { auth } from "@/auth";
import { PhotoEnhancerPanel } from "@/components/photo-enhancer/photo-enhancer-panel";
import { InlineNotice } from "@/components/portal/ui";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { redirect } from "next/navigation";

export default async function PhotoEnhancerPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <div className="mx-auto max-w-4xl">
        <InlineNotice>Select an active organization to use Photo Enhancer.</InlineNotice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PhotoEnhancerPanel />
    </div>
  );
}
