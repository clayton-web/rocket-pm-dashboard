import { auth } from "@/auth";
import { OffboardingQueueList } from "@/components/leasing/offboarding-queue-list";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import {
  listNoticeQueueForStaff,
  listNoticesAwaitingScheduleForStaff,
} from "@/lib/leasing/notice-staff-queue";
import {
  listTenanciesAwaitingInspectionCompleteForStaff,
  listTenanciesAwaitingInspectionScheduleForStaff,
} from "@/lib/leasing/offboarding-queue";
import { redirect } from "next/navigation";

export default async function LeasingOffboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <OffboardingQueueList
        initialPendingNotices={[]}
        initialAwaitingSchedule={[]}
        initialAwaitingInspectionSchedule={[]}
        initialAwaitingInspectionComplete={[]}
        loadError="Select an active organization to view offboarding."
      />
    );
  }

  try {
    const [pending, awaitingSchedule, awaitingInspectionSchedule, awaitingInspectionComplete] =
      await Promise.all([
        listNoticeQueueForStaff(ctx),
        listNoticesAwaitingScheduleForStaff(ctx),
        listTenanciesAwaitingInspectionScheduleForStaff(ctx),
        listTenanciesAwaitingInspectionCompleteForStaff(ctx),
      ]);
    return (
      <OffboardingQueueList
        initialPendingNotices={pending}
        initialAwaitingSchedule={awaitingSchedule}
        initialAwaitingInspectionSchedule={awaitingInspectionSchedule}
        initialAwaitingInspectionComplete={awaitingInspectionComplete}
        loadError={null}
      />
    );
  } catch {
    return (
      <OffboardingQueueList
        initialPendingNotices={[]}
        initialAwaitingSchedule={[]}
        initialAwaitingInspectionSchedule={[]}
        initialAwaitingInspectionComplete={[]}
        loadError="Could not load offboarding queue."
      />
    );
  }
}
