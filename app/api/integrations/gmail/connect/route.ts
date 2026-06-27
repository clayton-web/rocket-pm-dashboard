import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAbsoluteAppUrl } from "@/lib/app-path";
import { buildGmailAuthorizationUrl } from "@/lib/gmail/google-oauth";
import { signGmailOAuthState } from "@/lib/gmail/oauth-state";
import { requireActiveOrganization } from "@/lib/org/active-organization";
import { requireOrgAccess } from "@/lib/permissions/require-org-access";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(buildAbsoluteAppUrl("/login"));
  }

  let organizationId: string;
  try {
    const active = await requireActiveOrganization();
    organizationId = active.id;
  } catch {
    const url = buildAbsoluteAppUrl("/email");
    url.searchParams.set("error", "no_active_organization");
    return NextResponse.redirect(url);
  }

  try {
    await requireOrgAccess({
      userId: session.user.id,
      organizationId,
      minimumRole: "MEMBER",
    });
  } catch {
    const url = buildAbsoluteAppUrl("/email");
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
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
    const url = buildAbsoluteAppUrl("/email");
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  }
}
