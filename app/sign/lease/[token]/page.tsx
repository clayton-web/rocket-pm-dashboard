import { TenantLeaseSigningClient } from "@/components/signing/tenant-lease-signing-client";
import { InlineNotice, SURFACE_CARD } from "@/components/portal/ui";
import prisma from "@/lib/db/prisma";
import { getTenantSigningContextByToken } from "@/lib/leasing/lease-signing.service";
import { NotFoundError } from "@/lib/services/errors";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function LeaseSigningPage({ params }: PageProps) {
  const { token } = await params;

  try {
    const context = await getTenantSigningContextByToken(prisma, token);

    if (context.expired) {
      return (
        <SigningShell title="Signing link expired">
          <InlineNotice>This signing link has expired. Contact your property manager for a new link.</InlineNotice>
        </SigningShell>
      );
    }

    return (
      <SigningShell title="Sign tenancy agreement">
        <TenantLeaseSigningClient token={token} {...context} />
      </SigningShell>
    );
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    return (
      <SigningShell title="Unable to load signing page">
        <InlineNotice>Could not load this signing link.</InlineNotice>
      </SigningShell>
    );
  }
}

function SigningShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className={`${SURFACE_CARD} mx-auto max-w-lg p-6`}>
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
