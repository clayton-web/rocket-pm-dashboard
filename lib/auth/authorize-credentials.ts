import prisma from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { isDevCredentialsLoginEnabled } from "@/lib/runtime/production-guards";

export type CredentialsAuthorizeInput = Partial<Record<"email" | "password", unknown>>;

export type AuthorizedStaffUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

/**
 * NextAuth Credentials `authorize` implementation.
 * - Users with `passwordHash`: require correct password (works with or without dev flag).
 * - Users without `passwordHash`: email-only when dev login is enabled (never in production).
 * - `isActive=false` always rejects.
 */
export async function authorizeStaffCredentials(
  credentials: CredentialsAuthorizeInput | undefined,
): Promise<AuthorizedStaffUser | null> {
  const emailRaw = credentials?.email;
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!email) return null;

  const passwordRaw = credentials?.password;
  const password =
    typeof passwordRaw === "string" && passwordRaw.length > 0 ? passwordRaw : undefined;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.isActive) return null;

  if (user.passwordHash) {
    if (!password) return null;
    if (!(await verifyPassword(password, user.passwordHash))) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  }

  if (isDevCredentialsLoginEnabled() && !password) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  }

  return null;
}
