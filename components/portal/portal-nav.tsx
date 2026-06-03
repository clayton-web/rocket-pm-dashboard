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
      <Link href={href} className="text-sm font-medium text-neutral-700 underline underline-offset-2">
        ← {label}
      </Link>
    </p>
  );
}
