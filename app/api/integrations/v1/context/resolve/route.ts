import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { authenticateIntegrationRequest } from "@/lib/integrations/pm-context/authenticate-integration-request";
import type { ContextResolveResponse } from "@/lib/integrations/pm-context/context-resolve-contract";
import { CONTEXT_RESOLVE_VERSION } from "@/lib/integrations/pm-context/context-resolve-contract";
import { parseContextResolveRequest } from "@/lib/integrations/pm-context/context-resolve-request";
import {
  auditContextResolved,
  auditIntegrationAuthFailed,
  auditIntegrationRateLimited,
} from "@/lib/integrations/pm-context/integration-audit";
import {
  CONTEXT_RESOLVE_ROUTE,
  contextResolveRateLimit,
  contextResolveRateLimitKey,
  integrationAuthRateLimit,
} from "@/lib/integrations/pm-context/integration-route";
import { resolveContext, type ContextResolverDb } from "@/lib/integrations/pm-context/resolve-context";
import {
  checkRateLimit,
  getRequestClientKey,
  rateLimitedJsonResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Read-only PM context resolution for Rocket Communicator.
 *
 * Authenticates a server-to-server bearer credential; there is no staff session. All failure
 * modes collapse to a generic 401 so a caller cannot distinguish "no such credential" from
 * "revoked", "expired", or "wrong organization" — the specific reason goes to the audit log.
 */
export async function POST(request: Request) {
  // Pre-auth IP limit bounds credential guessing and the audit writes that failures produce.
  const authKey = getRequestClientKey(request, `POST:${CONTEXT_RESOLVE_ROUTE}`);
  const authLimited = checkRateLimit(authKey, integrationAuthRateLimit());
  if (!authLimited.ok) {
    return rateLimitedJsonResponse(authLimited.retryAfterSec);
  }

  const auth = await authenticateIntegrationRequest(prisma, request, {
    requiredScope: "PM_CONTEXT_READ",
  });

  if (!auth.ok) {
    await auditIntegrationAuthFailed({
      reason: auth.reason,
      credentialId: auth.credentialId,
      organizationId: auth.organizationId,
      keyId: auth.keyId,
      route: CONTEXT_RESOLVE_ROUTE,
    }).catch(() => undefined);
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { principal } = auth;

  const resolveLimited = checkRateLimit(
    contextResolveRateLimitKey(principal.credentialId),
    contextResolveRateLimit(),
  );
  if (!resolveLimited.ok) {
    await auditIntegrationRateLimited({
      credentialId: principal.credentialId,
      organizationId: principal.organizationId,
      route: CONTEXT_RESOLVE_ROUTE,
    }).catch(() => undefined);
    return rateLimitedJsonResponse(resolveLimited.retryAfterSec);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseContextResolveRequest(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const requestId = randomUUID();

  try {
    const result = await resolveContext(
      prisma as unknown as ContextResolverDb,
      principal,
      parsed.request,
    );

    await auditContextResolved({
      principal,
      requestId,
      signals: {
        hasSenderEmail: parsed.request.senderEmail !== null,
        addressHintCount: parsed.request.addressHints.length,
        unitHintCount: parsed.request.unitHints.length,
        hasKnownPropertyId: parsed.request.knownPropertyId !== null,
        hasKnownUnitId: parsed.request.knownUnitId !== null,
        unsupportedSignals: parsed.unsupportedSignals,
      },
      result,
    }).catch(() => undefined);

    const response: ContextResolveResponse = {
      version: CONTEXT_RESOLVE_VERSION,
      requestId,
      unsupportedSignals: parsed.unsupportedSignals,
      contacts: result.contacts,
      properties: result.properties,
      units: result.units,
      tenancies: result.tenancies,
      ownerContactMatches: result.ownerContactMatches,
    };
    return NextResponse.json(response);
  } catch (error) {
    // Never echo the resolver error: it can contain organization data. Log server-side only.
    console.error(`[POST ${CONTEXT_RESOLVE_ROUTE}] requestId=${requestId}`, error);
    return NextResponse.json({ error: "Context resolution failed.", requestId }, { status: 500 });
  }
}
