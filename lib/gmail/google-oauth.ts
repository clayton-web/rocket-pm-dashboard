import { GMAIL_OAUTH_SCOPES, getGmailOAuthRedirectUri, getGoogleOAuthClientCredentials } from "./oauth-config";

export function buildGmailAuthorizationUrl(stateToken: string): string {
  const { clientId } = getGoogleOAuthClientCredentials();
  const redirectUri = getGmailOAuthRedirectUri();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [...GMAIL_OAUTH_SCOPES].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: stateToken,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

export async function exchangeAuthorizationCode(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleOAuthClientCredentials();
  const redirectUri = getGmailOAuthRedirectUri();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleOAuthClientCredentials();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}
