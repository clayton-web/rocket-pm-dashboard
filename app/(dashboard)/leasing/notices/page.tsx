import { auth } from "@/auth";
import { NoticeQueueList } from "@/components/leasing/notice-queue-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { listNoticeQueueForStaff } from "@/lib/leasing/notice-staff-queue";
import { redirect } from "next/navigation";

export default async function LeasingNoticesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <NoticeQueueList initialNotices={[]} loadError="Select an active organization to view notices." />
    );
  }

  try {
    const rows = await listNoticeQueueForStaff(ctx);
    return <NoticeQueueList initialNotices={rows} loadError={null} />;
  } catch {
    return <NoticeQueueList initialNotices={[]} loadError="Could not load notices." />;
  }
}
