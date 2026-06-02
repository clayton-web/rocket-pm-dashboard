import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { isTokenVaultConfigured } from "@/lib/crypto/token-vault";
import { isProductionRuntime } from "@/lib/runtime/production-guards";

/** Public liveness/readiness — no secrets in response body. */
export async function GET() {
  const checks: Record<string, string | boolean> = {
    status: "ok",
    environment: process.env.NODE_ENV ?? "unknown",
  };

  let databaseOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    databaseOk = false;
    checks.database = "error";
  }

  checks.authSecretConfigured = Boolean(
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim(),
  );
  checks.gmailTokenEncryptionConfigured = isTokenVaultConfigured();
  checks.devCredentialsLoginEnabled = isProductionRuntime()
    ? false
    : process.env.DEV_CREDENTIALS_LOGIN === "true";

  const ok = databaseOk;
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
