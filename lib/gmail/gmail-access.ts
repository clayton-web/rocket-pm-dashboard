import prisma from "@/lib/db/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/token-vault";
import { GmailAuthError } from "@/lib/gmail/gmail-errors";
import { refreshGoogleAccessToken } from "@/lib/gmail/google-oauth";

const SKEW_MS = 60_000;

export async function markAccountNeedsReauth(accountId: string, message: string) {
  await prisma.connectedEmailAccount.update({
    where: { id: accountId },
    data: {
      status: "NEEDS_REAUTH",
      lastError: message,
    },
  });
}

export async function persistRefreshedAccessToken(args: {
  accountId: string;
  accessToken: string;
  expiresInSeconds: number;
  newRefreshToken?: string | null;
}) {
  const accessExpiresAt = new Date(Date.now() + Math.max(30, args.expiresInSeconds) * 1000);

  await prisma.connectedEmailAccount.update({
    where: { id: args.accountId },
    data: {
      accessTokenEnc: encryptSecret(args.accessToken),
      accessExpiresAt,
      ...(args.newRefreshToken
        ? { refreshTokenEnc: encryptSecret(args.newRefreshToken) }
        : {}),
      status: "CONNECTED",
      lastError: null,
    },
  });
}

export async function getValidGmailAccessToken(
  accountId: string,
  opts?: { forceRefresh?: boolean },
): Promise<string> {
  const account = await prisma.connectedEmailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new GmailAuthError("forbidden", "Mailbox not found.");
  }

  if (account.status === "REVOKED") {
    throw new GmailAuthError("needs_reauth", "Mailbox connection was revoked.");
  }

  const now = Date.now();
  const expiresAtMs = account.accessExpiresAt?.getTime() ?? 0;
  const hasAccess = Boolean(account.accessTokenEnc);
  const accessFresh = !opts?.forceRefresh && hasAccess && expiresAtMs - now > SKEW_MS;

  if (accessFresh && account.accessTokenEnc) {
    try {
      return decryptSecret(account.accessTokenEnc);
    } catch {
      await markAccountNeedsReauth(account.id, "Unable to read stored access token.");
      throw new GmailAuthError("needs_reauth", "Unable to decrypt stored access token.");
    }
  }

  if (!account.refreshTokenEnc) {
    await markAccountNeedsReauth(account.id, "Missing Gmail refresh token.");
    throw new GmailAuthError("needs_reauth", "Missing Gmail refresh token.");
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(account.refreshTokenEnc);
  } catch {
    await markAccountNeedsReauth(account.id, "Unable to decrypt refresh token.");
    throw new GmailAuthError("needs_reauth", "Unable to decrypt refresh token.");
  }

  try {
    const token = await refreshGoogleAccessToken(refreshToken);
    const newRefresh = token.refresh_token ?? null;
    await persistRefreshedAccessToken({
      accountId: account.id,
      accessToken: token.access_token,
      expiresInSeconds: token.expires_in,
      newRefreshToken: newRefresh,
    });
    return token.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed.";
    await markAccountNeedsReauth(account.id, message);
    throw new GmailAuthError("needs_reauth", message);
  }
}
