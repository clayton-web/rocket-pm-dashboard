import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { getAppBaseUrl } from "@/lib/gmail/app-base-url";
import { fetchGmailProfile } from "@/lib/gmail/gmail-profile";
import { exchangeAuthorizationCode } from "@/lib/gmail/google-oauth";
import { verifyGmailOAuthState } from "@/lib/gmail/oauth-state";
import { upsertConnectedGmailAccountFromOAuth } from "@/lib/gmail/persist-connected-account";
import { requireOrgAccess } from "@/lib/permissions/require-org-access";

function redirectToEmail(searchParams: Record<string, string>) {
  const url = new URL("/email", getAppBaseUrl());
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", getAppBaseUrl()));
  }

  const params = request.nextUrl.searchParams;
  const oauthError = params.get("error");
  if (oauthError) {
    return redirectToEmail({
      error: oauthError,
      error_detail: params.get("error_description") ?? "",
    });
  }

  const code = params.get("code");
  const stateToken = params.get("state");
  if (!code || !stateToken) {
    return redirectToEmail({ error: "missing_code_or_state" });
  }

  let state: ReturnType<typeof verifyGmailOAuthState>;
  try {
    state = verifyGmailOAuthState(stateToken);
  } catch {
    return redirectToEmail({ error: "invalid_state" });
  }

  if (state.userId !== session.user.id) {
    return redirectToEmail({ error: "session_mismatch" });
  }

  try {
    await requireOrgAccess({
      userId: session.user.id,
      organizationId: state.organizationId,
      minimumRole: "PROPERTY_MANAGER",
    });
  } catch {
    return redirectToEmail({ error: "forbidden" });
  }

  try {
    const token = await exchangeAuthorizationCode(code);
    const profile = await fetchGmailProfile(token.access_token);
    const expiresAt = new Date(Date.now() + Math.max(30, token.expires_in) * 1000);
    const scopes = (token.scope ?? "").split(/\s+/).filter(Boolean);

    const connection = await upsertConnectedGmailAccountFromOAuth({
      organizationId: state.organizationId,
      userId: session.user.id,
      email: profile.emailAddress,
      scopes,
      accessToken: token.access_token,
      accessExpiresAt: expiresAt,
      refreshToken: token.refresh_token ?? null,
      status: "CONNECTED",
      lastError: null,
    });

    await prisma.auditLog.create({
      data: {
        organizationId: state.organizationId,
        actorUserId: session.user.id,
        action: "gmail.connected",
        resourceType: "ConnectedEmailAccount",
        resourceId: connection.id,
        metadata: {
          email: profile.emailAddress,
        },
      },
    });

    return redirectToEmail({ connected: connection.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return redirectToEmail({ error: message });
  }
}
