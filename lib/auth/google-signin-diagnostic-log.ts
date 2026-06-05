import { Prisma } from "@prisma/client";

const LOG_PREFIX = "[auth:google-signin]";

function prismaErrorFields(error: unknown): { code?: string; message: string } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return { code: "UNKNOWN_REQUEST", message: error.message };
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { code: "VALIDATION", message: error.message };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: String(error) };
}

/** Temporary diagnostic logging for Google staff sign-in — remove after AccessDenied is resolved. */
export function logGoogleSignInStart(args: { provider: string; email: string }) {
  console.info(LOG_PREFIX, "callback_start", {
    provider: args.provider,
    email: args.email,
  });
}

export function logGoogleSignInExistingUser(args: {
  email: string;
  found: boolean;
  userId?: string;
  isActive?: boolean;
}) {
  console.info(LOG_PREFIX, "existing_user_lookup", {
    email: args.email,
    found: args.found,
    userId: args.userId ?? null,
    isActive: args.isActive ?? null,
  });
}

export function logGoogleSignInDeniedInactive(args: { email: string; userId: string }) {
  console.warn(LOG_PREFIX, "denied_inactive_user", {
    email: args.email,
    userId: args.userId,
    isActive: false,
  });
}

export function logGoogleSignInUpsertStart(args: { email: string }) {
  console.info(LOG_PREFIX, "upsert_start", { email: args.email });
}

export function logGoogleSignInUpsertSuccess(args: { email: string }) {
  console.info(LOG_PREFIX, "upsert_success", { email: args.email });
}

export function logGoogleSignInUpsertError(args: { email: string; error: unknown }) {
  const fields = prismaErrorFields(args.error);
  console.error(LOG_PREFIX, "upsert_error", {
    email: args.email,
    prismaCode: fields.code ?? null,
    message: fields.message,
  });
}
