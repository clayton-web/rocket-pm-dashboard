"use server";

import { BuildiumConnectionStatus, BuildiumEnvironment } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireStaffContextFromSession, StaffAuthError } from "@/lib/auth/staff-from-session";
import prisma from "@/lib/db/prisma";
import {
  auditBuildiumConnectionTested,
  auditBuildiumCredentialsSaved,
  auditBuildiumDisconnected,
} from "@/lib/integrations/buildium/buildium-audit";
import {
  assertBuildiumVaultReady,
  decryptBuildiumSecret,
  encryptBuildiumSecret,
} from "@/lib/integrations/buildium/secret-storage";
import { testBuildiumConnection } from "@/lib/integrations/buildium/test-connection";
import { BuildiumApiError } from "@/lib/integrations/buildium/errors";
import { ForbiddenError } from "@/lib/services/errors";
import { requireOrganizationAdmin } from "@/lib/services/property-access";

export type BuildiumActionResult = { ok: true } | { ok: false; error: string };

export type BuildiumTestConnectionActionResult =
  | { ok: true; propertyCount: number; samplePropertyName: string | null }
  | { ok: false; error: string };

function parseEnvironment(value: unknown): BuildiumEnvironment | { error: string } {
  if (value === BuildiumEnvironment.PRODUCTION || value === "PRODUCTION") {
    return BuildiumEnvironment.PRODUCTION;
  }
  if (value === BuildiumEnvironment.SANDBOX || value === "SANDBOX") {
    return BuildiumEnvironment.SANDBOX;
  }
  return { error: "Invalid Buildium environment." };
}

function isEnvError(
  value: BuildiumEnvironment | { error: string },
): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

async function requireBuildiumAdminContext() {
  const ctx = await requireStaffContextFromSession();
  requireOrganizationAdmin(ctx);
  return { ctx, actorUserId: ctx.userId };
}

export async function saveBuildiumCredentialsAction(args: {
  environment: unknown;
  clientId: string;
  clientSecret?: string;
}): Promise<BuildiumActionResult> {
  try {
    const { ctx, actorUserId } = await requireBuildiumAdminContext();
    const environment = parseEnvironment(args.environment);
    if (isEnvError(environment)) {
      return { ok: false, error: environment.error };
    }

    const clientId = args.clientId?.trim() ?? "";
    if (!clientId) {
      return { ok: false, error: "Client ID is required." };
    }

    assertBuildiumVaultReady();

    const existing = await prisma.buildiumConnection.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    const secretPlain = args.clientSecret?.trim();
    if (!existing && !secretPlain) {
      return { ok: false, error: "Client secret is required on first save." };
    }

    let clientSecretEnc: string;
    if (secretPlain) {
      clientSecretEnc = encryptBuildiumSecret(secretPlain);
    } else if (existing) {
      clientSecretEnc = existing.clientSecretEnc;
    } else {
      return { ok: false, error: "Client secret is required." };
    }

    const connection = await prisma.buildiumConnection.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        environment,
        clientId,
        clientSecretEnc,
        status: BuildiumConnectionStatus.DISCONNECTED,
      },
      update: {
        environment,
        clientId,
        clientSecretEnc,
        status: secretPlain ? BuildiumConnectionStatus.DISCONNECTED : undefined,
        lastSyncError: secretPlain ? null : undefined,
      },
    });

    await auditBuildiumCredentialsSaved({
      organizationId: ctx.organizationId,
      actorUserId,
      connectionId: connection.id,
      environment,
    });

    revalidatePath("/settings/integrations/buildium");
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError || e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not save Buildium credentials.";
    return { ok: false, error: message };
  }
}

export async function testBuildiumConnectionAction(args: {
  clientSecret?: string;
}): Promise<BuildiumTestConnectionActionResult> {
  try {
    const { ctx, actorUserId } = await requireBuildiumAdminContext();

    const connection = await prisma.buildiumConnection.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    if (!connection) {
      return { ok: false, error: "Save Buildium credentials before testing the connection." };
    }

    const secretOverride = args.clientSecret?.trim();
    let clientSecret: string;
    if (secretOverride) {
      clientSecret = secretOverride;
    } else {
      clientSecret = decryptBuildiumSecret(connection.clientSecretEnc);
    }

    const result = await testBuildiumConnection({
      environment: connection.environment,
      clientId: connection.clientId,
      clientSecret,
    });

    if (result.ok) {
      await prisma.buildiumConnection.update({
        where: { id: connection.id },
        data: {
          status: BuildiumConnectionStatus.CONNECTED,
          lastTestedAt: new Date(),
          lastSyncError: null,
        },
      });
      await auditBuildiumConnectionTested({
        organizationId: ctx.organizationId,
        actorUserId,
        connectionId: connection.id,
        success: true,
        propertyCount: result.propertyCount,
      });
      revalidatePath("/settings/integrations/buildium");
      return {
        ok: true,
        propertyCount: result.propertyCount,
        samplePropertyName: result.samplePropertyName,
      };
    }

    const status =
      result.code === "UNAUTHORIZED" || result.code === "FORBIDDEN"
        ? BuildiumConnectionStatus.NEEDS_REAUTH
        : BuildiumConnectionStatus.ERROR;

    await prisma.buildiumConnection.update({
      where: { id: connection.id },
      data: {
        status,
        lastTestedAt: new Date(),
        lastSyncError: result.error,
      },
    });
    await auditBuildiumConnectionTested({
      organizationId: ctx.organizationId,
      actorUserId,
      connectionId: connection.id,
      success: false,
      errorMessage: result.error,
    });
    revalidatePath("/settings/integrations/buildium");
    return { ok: false, error: result.error };
  } catch (e) {
    if (e instanceof StaffAuthError || e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof BuildiumApiError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not test Buildium connection.";
    return { ok: false, error: message };
  }
}

export async function disconnectBuildiumAction(): Promise<BuildiumActionResult> {
  try {
    const { ctx, actorUserId } = await requireBuildiumAdminContext();

    const connection = await prisma.buildiumConnection.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    if (!connection) {
      return { ok: true };
    }

    await prisma.buildiumConnection.delete({ where: { id: connection.id } });
    await auditBuildiumDisconnected({
      organizationId: ctx.organizationId,
      actorUserId,
      connectionId: connection.id,
    });

    revalidatePath("/settings/integrations/buildium");
    return { ok: true };
  } catch (e) {
    if (e instanceof StaffAuthError || e instanceof ForbiddenError) {
      return { ok: false, error: e.message };
    }
    const message = e instanceof Error ? e.message : "Could not disconnect Buildium.";
    return { ok: false, error: message };
  }
}
