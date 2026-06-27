import type { BuildiumClientOptions } from "@/lib/integrations/buildium/client";
import { buildiumGetJson } from "@/lib/integrations/buildium/client";
import { buildPaginationQuery } from "@/lib/integrations/buildium/pagination";
import type { BuildiumListRentalsResponse } from "@/lib/integrations/buildium/types";

export async function listRentals(
  options: BuildiumClientOptions,
  params: { limit?: number; offset?: number } = {},
): Promise<{ properties: BuildiumListRentalsResponse; totalCount: number | null }> {
  const query = buildPaginationQuery({
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    orderby: "Id asc",
  });

  const result = await buildiumGetJson<BuildiumListRentalsResponse>(
    options,
    "/v1/rentals",
    query,
  );

  return {
    properties: result.data,
    totalCount: result.totalCount,
  };
}
