import { InlineNotice } from "@/components/portal/ui";

export function ThreadContextWarning() {
  return (
    <InlineNotice className="mt-3 border-amber-200 bg-amber-50 text-amber-950">
      No PM context linked. AI drafts may be generic until you link property, tenancy, or maintenance
      records.
    </InlineNotice>
  );
}
