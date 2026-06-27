import { BriefingSourceType } from "@prisma/client";
import { createStubBriefingModule } from "@/lib/briefing/sources/stub-briefing-module";

export const leasingBriefingModule = createStubBriefingModule({
  sourceType: BriefingSourceType.APPLICATION,
  moduleId: "leasing",
});
