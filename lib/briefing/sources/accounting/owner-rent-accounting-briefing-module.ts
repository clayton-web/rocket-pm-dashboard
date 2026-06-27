import { BriefingSourceType } from "@prisma/client";
import { createStubBriefingModule } from "@/lib/briefing/sources/stub-briefing-module";

export const ownerRentAccountingBriefingModule = createStubBriefingModule({
  sourceType: BriefingSourceType.RENT_PAYMENT,
  moduleId: "owner-rent-accounting",
});
