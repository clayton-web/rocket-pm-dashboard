import { BriefingSourceType } from "@prisma/client";
import { createStubBriefingModule } from "@/lib/briefing/sources/stub-briefing-module";

export const maintenanceBriefingModule = createStubBriefingModule({
  sourceType: BriefingSourceType.MAINTENANCE,
  moduleId: "maintenance",
});
