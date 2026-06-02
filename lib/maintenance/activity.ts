import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export async function logMaintenanceActivity(args: {
  propertyId: string;
  actorUserId?: string | null;
  entityId: string;
  action: "maintenance.created" | "maintenance.status_updated";
  newValues?: Prisma.InputJsonValue;
  oldValues?: Prisma.InputJsonValue;
}) {
  await prisma.activityLog.create({
    data: {
      propertyId: args.propertyId,
      actorUserId: args.actorUserId ?? null,
      entityType: "MaintenanceRequest",
      entityId: args.entityId,
      action: args.action,
      newValues: args.newValues,
      oldValues: args.oldValues,
    },
  });
}
