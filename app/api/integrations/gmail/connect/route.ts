import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/gmail/app-base-url";
import { buildGmailAuthorizationUrl } from "@/lib/gmail/google-oauth";
import { signGmailOAuthState } from "@/lib/gmail/oauth-state";
import { requireActiveOrganization } from "@/lib/org/active-organization";
import { requireOrgAccess } from "@/lib/permissions/require-org-access";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", getAppBaseUrl()));
  }

  let organizationId: string;
  try {
    const active = await requireActiveOrganization();
    organizationId = active.id;
  } catch {
    return NextResponse.redirect(new URL("/email?error=no_active_organization", getAppBaseUrl()));
  }

  try {
    await requireOrgAccess({
      userId: session.user.id,
      organizationId,
      minimumRole: "PROPERTY_MANAGER",
    });
  } catch {
    return NextResponse.redirect(new URL("/email?error=forbidden", getAppBaseUrl()));
  }

  try {
    const state = signGmailOAuthState({
      userId: session.user.id,
      organizationId,
    });
    const url = buildGmailAuthorizationUrl(state);
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_configuration_error";
    return NextResponse.redirect(new URL(`/email?error=${encodeURIComponent(message)}`, getAppBaseUrl()));
  }
}
