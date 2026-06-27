import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

export async function auditBuildiumCredentialsSaved(args: {
  organizationId: string;
  actorUserId: string;
  connectionId: string;
  environment: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "buildium.credentials.saved",
      resourceType: "BuildiumConnection",
      resourceId: args.connectionId,
      metadata: {
        environment: args.environment,
      } satisfies Prisma.InputJsonValue,
    },
  });
}

export async function auditBuildiumConnectionTested(args: {
  organizationId: string;
  actorUserId: string;
  connectionId: string;
  success: boolean;
  propertyCount?: number;
  errorMessage?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "buildium.connection.tested",
      resourceType: "BuildiumConnection",
      resourceId: args.connectionId,
      metadata: {
        success: args.success,
        propertyCount: args.propertyCount ?? null,
        errorMessage: args.errorMessage?.slice(0, 500) ?? null,
      } satisfies Prisma.InputJsonValue,
    },
  });
}

export async function auditBuildiumDisconnected(args: {
  organizationId: string;
  actorUserId: string;
  connectionId: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      action: "buildium.disconnected",
      resourceType: "BuildiumConnection",
      resourceId: args.connectionId,
    },
  });
}
