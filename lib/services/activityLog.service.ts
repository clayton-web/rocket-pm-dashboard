import type { Prisma, PrismaClient } from "@prisma/client";
import { isTenantAccount } from "@/lib/services/property-access";
import type { StaffContext } from "@/lib/services/staff-context";

export type ActivityLogInput = {
  propertyId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId?: string | null;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
};

const MAX_STRING_LEN = 500;
const MAX_ARRAY = 50;
const MAX_OBJECT_KEYS = 30;
const MAX_DEPTH = 4;

export function asAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  const walk = (v: unknown, depth: number): Prisma.InputJsonValue => {
    if (depth > MAX_DEPTH) return "[truncated]";
    if (v === null) return null as unknown as Prisma.InputJsonValue;
    if (typeof v === "string") {
      return v.length > MAX_STRING_LEN ? `${v.slice(0, MAX_STRING_LEN)}…` : v;
    }
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "boolean") return v;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) {
      return v.slice(0, MAX_ARRAY).map((x) => walk(x, depth + 1));
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o).slice(0, MAX_OBJECT_KEYS);
      const out: Record<string, Prisma.InputJsonValue> = {};
      for (const k of keys) out[k] = walk(o[k], depth + 1);
      return out;
    }
    return String(v);
  };
  return walk(value, 0);
}

export function pickForAudit<T extends object>(obj: T, keys: (keyof T)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) out[String(k)] = obj[k] as unknown;
  }
  return out;
}

export function actorIdForLog(principal: StaffContext | null | undefined): string | null {
  if (!principal) return null;
  if (isTenantAccount(principal)) return null;
  return principal.userId;
}

export async function logActivity(prisma: PrismaClient, input: ActivityLogInput): Promise<void> {
  await prisma.activityLog.create({
    data: {
      propertyId: input.propertyId ?? null,
      actorUserId: input.actorUserId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      oldValues: input.oldValues ?? undefined,
      newValues: input.newValues ?? undefined,
    },
  });
}

export async function logStaffActivity(
  prisma: PrismaClient,
  principal: StaffContext | null | undefined,
  input: Omit<ActivityLogInput, "actorUserId">,
): Promise<void> {
  await logActivity(prisma, {
    ...input,
    actorUserId: actorIdForLog(principal),
  });
}

export async function logPropertyActivity(
  prisma: PrismaClient,
  principal: StaffContext | null | undefined,
  propertyId: string,
  entityType: string,
  entityId: string,
  action: string,
  patch?: { oldValues?: unknown; newValues?: unknown },
): Promise<void> {
  await logStaffActivity(prisma, principal, {
    propertyId,
    entityType,
    entityId,
    action,
    oldValues: patch?.oldValues !== undefined ? asAuditJson(patch.oldValues) : undefined,
    newValues: patch?.newValues !== undefined ? asAuditJson(patch.newValues) : undefined,
  });
}
