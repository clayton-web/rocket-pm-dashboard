export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  // Allow local `next build` with dev .env; enforce on production server boot.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { validateProductionRuntimeConfig } = await import("@/lib/runtime/production-guards");
  validateProductionRuntimeConfig();
}
