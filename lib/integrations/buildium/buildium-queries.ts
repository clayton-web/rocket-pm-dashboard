import type { BuildiumConnectionStatus, BuildiumEnvironment } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { isTokenVaultConfigured } from "@/lib/crypto/token-vault";

export type BuildiumSettingsView = {
  organizationName: string;
  canEdit: boolean;
  vaultConfigured: boolean;
  readOnlyMode: boolean;
  connection: {
    id: string | null;
    status: BuildiumConnectionStatus | "DISCONNECTED";
    environment: BuildiumEnvironment;
    clientId: string;
    hasSecret: boolean;
    lastTestedAt: string | null;
    lastSyncError: string | null;
  };
};

export async function getBuildiumSettingsView(args: {
  organizationId: string;
  canEdit: boolean;
}): Promise<BuildiumSettingsView> {
  const [organization, connection] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: args.organizationId },
      select: { name: true },
    }),
    prisma.buildiumConnection.findUnique({
      where: { organizationId: args.organizationId },
    }),
  ]);

  const readOnlyRaw = process.env.BUILDIUM_READ_ONLY?.trim().toLowerCase();
  const readOnlyMode =
    !readOnlyRaw || readOnlyRaw === "true" || readOnlyRaw === "1" || readOnlyRaw === "yes";

  if (!connection) {
    return {
      organizationName: organization.name,
      canEdit: args.canEdit,
      vaultConfigured: isTokenVaultConfigured(),
      readOnlyMode,
      connection: {
        id: null,
        status: "DISCONNECTED",
        environment: "PRODUCTION",
        clientId: "",
        hasSecret: false,
        lastTestedAt: null,
        lastSyncError: null,
      },
    };
  }

  return {
    organizationName: organization.name,
    canEdit: args.canEdit,
    vaultConfigured: isTokenVaultConfigured(),
    readOnlyMode,
    connection: {
      id: connection.id,
      status: connection.status,
      environment: connection.environment,
      clientId: connection.clientId,
      hasSecret: connection.clientSecretEnc.length > 0,
      lastTestedAt: connection.lastTestedAt?.toISOString() ?? null,
      lastSyncError: connection.lastSyncError,
    },
  };
}
