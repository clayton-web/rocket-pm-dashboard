import { getAppBaseUrl } from "@/lib/gmail/app-base-url";

// Required by `users.drafts.create`; `gmail.send` alone is not sufficient.
export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  GMAIL_COMPOSE_SCOPE,
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export type GoogleOAuthClientCredentials = {
  clientId: string;
  clientSecret: string;
};

export function getGoogleOAuthClientCredentials(): GoogleOAuthClientCredentials {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret =
    process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Google OAuth client credentials. Set GOOGLE_GMAIL_CLIENT_ID/SECRET or reuse GOOGLE_CLIENT_ID/SECRET.",
    );
  }

  return { clientId, clientSecret };
}

export function getGmailOAuthRedirectUri(): string {
  const explicit = process.env.GOOGLE_GMAIL_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit;
  }
  return `${getAppBaseUrl()}/api/integrations/gmail/callback`;
}
