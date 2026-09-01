import { FOCUS_RING } from "@/components/portal/focus";
import Link from "next/link";

export function PortalBackLink({
  label = "Back to tenant portal",
  href = "/portal",
}: {
  label?: string;
  href?: string;
}) {
  return (
    <p className="mb-4">
      <Link href={href} className={`text-sm font-medium text-foreground-muted underline underline-offset-2 ${FOCUS_RING}`}>
        ← {label}
      </Link>
    </p>
  );
}
