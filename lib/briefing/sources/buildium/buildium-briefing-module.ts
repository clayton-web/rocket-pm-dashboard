import { BriefingSourceType } from "@prisma/client";
import { createStubBriefingModule } from "@/lib/briefing/sources/stub-briefing-module";

export const buildiumBriefingModule = createStubBriefingModule({
  sourceType: BriefingSourceType.DEPOSIT,
  moduleId: "buildium",
});
