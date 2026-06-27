import { BriefingSourceType } from "@prisma/client";
import { createStubBriefingModule } from "@/lib/briefing/sources/stub-briefing-module";

export const buildingBriefingModule = createStubBriefingModule({
  sourceType: BriefingSourceType.SYSTEM,
  moduleId: "building",
});
