import { auth } from "@/auth";
import { NoticeQueueList } from "@/components/leasing/notice-queue-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import {
  listNoticeQueueForStaff,
  listNoticesAwaitingScheduleForStaff,
} from "@/lib/leasing/notice-staff-queue";
import { redirect } from "next/navigation";

export default async function LeasingNoticesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <NoticeQueueList
        initialPendingNotices={[]}
        initialAwaitingSchedule={[]}
        loadError="Select an active organization to view notices."
      />
    );
  }

  try {
    const [pending, awaitingSchedule] = await Promise.all([
      listNoticeQueueForStaff(ctx),
      listNoticesAwaitingScheduleForStaff(ctx),
    ]);
    return (
      <NoticeQueueList
        initialPendingNotices={pending}
        initialAwaitingSchedule={awaitingSchedule}
        loadError={null}
      />
    );
  } catch {
    return (
      <NoticeQueueList
        initialPendingNotices={[]}
        initialAwaitingSchedule={[]}
        loadError="Could not load notices."
      />
    );
  }
}
