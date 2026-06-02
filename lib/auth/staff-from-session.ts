import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { getActiveOrganizationContext } from "@/lib/org/active-organization";
import { loadStaffContext, type StaffContext } from "@/lib/services/staff-context";

export class StaffAuthError extends Error {
  constructor(
    message: string,
    readonly code: "unauthenticated" | "no_active_org" | "forbidden",
  ) {
    super(message);
    this.name = "StaffAuthError";
  }
}

/** For server components / route handlers: session user + active org → {@link StaffContext}. */
export async function getStaffContextFromSession(): Promise<StaffContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const active = await getActiveOrganizationContext();
  if (!active) return null;

  return loadStaffContext(prisma, session.user.id, active.id);
}

/** Throws {@link StaffAuthError} when session or org context is missing. */
export async function requireStaffContextFromSession(): Promise<StaffContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new StaffAuthError("Sign in required", "unauthenticated");
  }

  const active = await getActiveOrganizationContext();
  if (!active) {
    throw new StaffAuthError("Select an active organization", "no_active_org");
  }

  const ctx = await loadStaffContext(prisma, session.user.id, active.id);
  if (!ctx) {
    throw new StaffAuthError("No access in this organization", "forbidden");
  }

  return ctx;
}
