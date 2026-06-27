export type BuildiumPaginationParams = {
  limit?: number;
  offset?: number;
  orderby?: string;
};

export function buildPaginationQuery(params: BuildiumPaginationParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    search.set("offset", String(params.offset));
  }
  if (params.orderby) {
    search.set("orderby", params.orderby);
  }
  return search;
}

export function parseTotalCountHeader(headers: Headers): number | null {
  const raw = headers.get("X-Total-Count") ?? headers.get("x-total-count");
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ items: T[]; totalCount: number | null }>,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 100;
  const all: T[] = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const { items, totalCount } = await fetchPage(offset, pageSize);
    all.push(...items);
    if (items.length < pageSize) {
      break;
    }
    offset += pageSize;
    if (totalCount !== null && offset >= totalCount) {
      break;
    }
  }

  return all;
}
