/**
 * Deterministic address/unit hint normalization for the PM context resolver.
 *
 * This is canonicalization, not fuzzy matching: two strings normalize to the same key only when
 * they are the same address written differently (case, punctuation, standard abbreviations). No
 * edit distance, no token overlap scoring, no inference. A hint that does not normalize to an
 * exact stored value produces no candidate.
 */

const STREET_TYPE_ALIASES: Record<string, string> = {
  st: "street",
  str: "street",
  ave: "avenue",
  av: "avenue",
  rd: "road",
  dr: "drive",
  blvd: "boulevard",
  blv: "boulevard",
  cres: "crescent",
  cr: "crescent",
  pl: "place",
  ct: "court",
  crt: "court",
  ln: "lane",
  hwy: "highway",
  pkwy: "parkway",
  terr: "terrace",
  ter: "terrace",
  sq: "square",
  gdns: "gardens",
  gdn: "gardens",
  trl: "trail",
  cir: "circle",
};

const DIRECTIONAL_ALIASES: Record<string, string> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  ne: "northeast",
  nw: "northwest",
  se: "southeast",
  sw: "southwest",
};

/** Unit prefixes that appear in BC addresses: "Unit 204", "Apt 204", "Suite 204", "# 204". */
const UNIT_PREFIX_RE = /^(?:unit|apt|apartment|suite|ste|no)\b\.?\s*/i;

/** Leading unit in dash form: "204-123 Main Street" or "204 - 123 Main St". */
const LEADING_UNIT_DASH_RE = /^([0-9]{1,5}[a-z]?)\s*[-–—]\s*(?=[0-9])/i;

/** Leading unit in hash form: "#204 123 Main Street". */
const LEADING_UNIT_HASH_RE = /^#\s*([0-9]{1,5}[a-z]?)\s+(?=[0-9])/i;

function collapse(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical key for a street line. Expands standard street-type and directional abbreviations so
 * "123 Main St W" and "123 main street west" resolve to the same stored property.
 */
export function normalizeStreetLineKey(raw: string): string {
  const collapsed = collapse(raw).replace(/^#\s*/, "");
  if (!collapsed) return "";

  return collapsed
    .split(" ")
    .map((token) => STREET_TYPE_ALIASES[token] ?? DIRECTIONAL_ALIASES[token] ?? token)
    .join(" ");
}

/** Canonical key for a unit label. "Unit 204", "#204", and "204" all become "204". */
export function normalizeUnitKey(raw: string): string {
  const stripped = collapse(raw).replace(/^#\s*/, "").replace(UNIT_PREFIX_RE, "");
  return stripped.replace(/^#\s*/, "").trim();
}

export type ParsedAddressHint = {
  /** Normalized street line, or empty when the hint carried no street portion. */
  streetKey: string;
  /** Unit label embedded in the hint ("204-123 Main St"), normalized. Null when absent. */
  unitKey: string | null;
};

/**
 * Splits a single-line hint into a street key and any embedded unit label.
 *
 * Only the two unambiguous BC forms are recognised — a leading `204-` before a street number and
 * a leading `#204 ` before a street number. Anything else is treated wholly as a street line so a
 * house number is never mistaken for a unit.
 */
export function parseAddressHint(raw: string): ParsedAddressHint {
  const collapsed = collapse(raw);
  if (!collapsed) return { streetKey: "", unitKey: null };

  const dashMatch = collapsed.match(LEADING_UNIT_DASH_RE);
  if (dashMatch) {
    return {
      streetKey: normalizeStreetLineKey(collapsed.slice(dashMatch[0].length)),
      unitKey: normalizeUnitKey(dashMatch[1]!),
    };
  }

  const hashMatch = collapsed.match(LEADING_UNIT_HASH_RE);
  if (hashMatch) {
    return {
      streetKey: normalizeStreetLineKey(collapsed.slice(hashMatch[0].length)),
      unitKey: normalizeUnitKey(hashMatch[1]!),
    };
  }

  return { streetKey: normalizeStreetLineKey(collapsed), unitKey: null };
}

/** Normalizes an email for exact comparison. Returns null when the value is not an address. */
export function normalizeIntegrationEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const angle = trimmed.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1]! : trimmed).replace(/[<>]/g, "").trim();
  if (!candidate.includes("@")) return null;
  if (/\s/.test(candidate)) return null;

  return candidate;
}
