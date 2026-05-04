import prisma from "@/lib/db/prisma";
import type { ConnectedEmailAccountStatus } from "@prisma/client";
import { assertTokenVaultReadyForConnect, encryptSecret } from "@/lib/crypto/token-vault";

type UpsertArgs = {
  organizationId: string;
  userId: string;
  email: string;
  scopes: string[];
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken?: string | null;
  status?: ConnectedEmailAccountStatus;
  lastError?: string | null;
};

export async function upsertConnectedGmailAccountFromOAuth(args: UpsertArgs) {
  assertTokenVaultReadyForConnect();

  const existing = await prisma.connectedEmailAccount.findUnique({
    where: {
      organizationId_email: {
        organizationId: args.organizationId,
        email: args.email,
      },
    },
  });

  if (existing && existing.userId !== args.userId) {
    throw new Error("This Gmail address is already connected by another user in this organization.");
  }

  const refreshTokenEnc =
    args.refreshToken != null && args.refreshToken !== ""
      ? encryptSecret(args.refreshToken)
      : existing?.refreshTokenEnc ?? null;

  const accessTokenEnc = encryptSecret(args.accessToken);

  const shouldNeedReauth = !refreshTokenEnc;

  const status: ConnectedEmailAccountStatus = shouldNeedReauth
    ? "NEEDS_REAUTH"
    : (args.status ?? "CONNECTED");

  const lastError = shouldNeedReauth
    ? "Google did not return a refresh token. Try again and confirm all permissions."
    : (args.lastError ?? null);

  return prisma.connectedEmailAccount.upsert({
    where: {
      organizationId_email: {
        organizationId: args.organizationId,
        email: args.email,
      },
    },
    create: {
      organizationId: args.organizationId,
      userId: args.userId,
      provider: "gmail",
      email: args.email,
      scopes: args.scopes,
      refreshTokenEnc,
      accessTokenEnc,
      accessExpiresAt: args.accessExpiresAt,
      status,
      lastError,
    },
    update: {
      userId: args.userId,
      scopes: args.scopes,
      refreshTokenEnc,
      accessTokenEnc,
      accessExpiresAt: args.accessExpiresAt,
      status,
      lastError,
    },
  });
}
