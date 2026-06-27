import type { BuildiumEnvironment } from "@prisma/client";
import { BuildiumApiError } from "@/lib/integrations/buildium/errors";
import { listRentals } from "@/lib/integrations/buildium/endpoints/rentals";
import type { BuildiumFetchFn } from "@/lib/integrations/buildium/client";

export type BuildiumTestConnectionInput = {
  environment: BuildiumEnvironment;
  clientId: string;
  clientSecret: string;
  fetchFn?: BuildiumFetchFn;
};

export type BuildiumTestConnectionResult =
  | {
      ok: true;
      propertyCount: number;
      totalCount: number | null;
      samplePropertyName: string | null;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function testBuildiumConnection(
  input: BuildiumTestConnectionInput,
): Promise<BuildiumTestConnectionResult> {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();

  if (!clientId || !clientSecret) {
    return { ok: false, error: "Client ID and secret are required.", code: "VALIDATION" };
  }

  try {
    const { properties, totalCount } = await listRentals(
      {
        environment: input.environment,
        credentials: { clientId, clientSecret },
        fetchFn: input.fetchFn,
      },
      { limit: 1, offset: 0 },
    );

    const propertyCount = totalCount ?? properties.length;
    const sample = properties[0];

    return {
      ok: true,
      propertyCount,
      totalCount,
      samplePropertyName: sample?.Name ?? sample?.StructureDescription ?? null,
    };
  } catch (error) {
    if (error instanceof BuildiumApiError) {
      return {
        ok: false,
        error: error.message,
        code: error.code,
      };
    }
    const message = error instanceof Error ? error.message : "Could not reach Buildium API.";
    return { ok: false, error: message, code: "UNKNOWN" };
  }
}
