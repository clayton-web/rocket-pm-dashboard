import { InlineNotice } from "@/components/portal/ui";

export function ThreadContextWarning() {
  return (
    <InlineNotice tone="warning" size="compact" className="mt-3">
      No PM context linked. AI drafts may be generic until you link property, tenancy, or maintenance
      records.
    </InlineNotice>
  );
}
