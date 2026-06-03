import type { Notice, Prisma, Tenancy } from "@prisma/client";
import type { NoticeRulesTenancy } from "@/lib/leasing/notice-rules";
import { toDateOnlyUTC } from "@/lib/leasing/notice-rules";

export const TENANT_NOTICE_TO_END_TYPE = "tenant_notice_to_end";
export const TENANT_NOTICE_SERVICE_METHOD = "tenant_portal";
export const TENANT_NOTICE_DEFAULT_TITLE = "Notice to end tenancy";

export function tenancyToNoticeRules(tenancy: Pick<Tenancy, "rentDueDay" | "leaseEndDate">): NoticeRulesTenancy {
  return {
    rentDueDay: tenancy.rentDueDay,
    leaseEndDate: tenancy.leaseEndDate,
  };
}

export function isPendingTenantEndNotice(notice: Pick<Notice, "noticeType" | "servedAt">): boolean {
  return notice.noticeType === TENANT_NOTICE_TO_END_TYPE && notice.servedAt == null;
}

export function pendingTenantEndNoticeWhere(tenancyId: string): Prisma.NoticeWhereInput {
  return {
    tenancyId,
    noticeType: TENANT_NOTICE_TO_END_TYPE,
    servedAt: null,
  };
}

export function formatMoveOutDateLabel(date: Date): string {
  return toDateOnlyUTC(date).toISOString().slice(0, 10);
}
