import prisma from "@/lib/db/prisma";

/** Neon/serverless may return a closed idle connection on a warm lambda reuse. */
export function isStalePrismaConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /connection.*closed|kind:\s*Closed|Server has closed the connection/i.test(message);
}

/** Retry once after reconnecting — used for short auth callback DB work only. */
export async function withPrismaConnectionRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isStalePrismaConnectionError(error)) {
      throw error;
    }
    await prisma.$connect();
    return await fn();
  }
}
