import { auth } from "@/auth";
import { NoticeDetail } from "@/components/leasing/notice-detail";
import { getStaffContextFromSession } from "@/lib/auth/staff-from-session";
import { getNoticeDetailForStaff } from "@/lib/leasing/notice-staff-detail";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeasingNoticeDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const ctx = await getStaffContextFromSession();
  if (!ctx) {
    return (
      <NoticeDetail
        initialDetail={null}
        loadError="Select an active organization to view this notice."
      />
    );
  }

  try {
    const detail = await getNoticeDetailForStaff(ctx, id);
    return <NoticeDetail initialDetail={detail} loadError={null} />;
  } catch (e) {
    if (e instanceof NotFoundError) {
      return <NoticeDetail initialDetail={null} loadError="Notice not found." />;
    }
    if (e instanceof ForbiddenError) {
      return (
        <NoticeDetail initialDetail={null} loadError="You do not have access to this notice." />
      );
    }
    return <NoticeDetail initialDetail={null} loadError="Could not load notice." />;
  }
}
