/** Craigslist subdomain hostname for a PM-entered city (Canadian listings). */
const CITY_HOSTNAME_OVERRIDES: Record<string, string> = {
  vancouver: "vancouver",
  "vancouver bc": "vancouver",
  burnaby: "vancouver",
  richmond: "vancouver",
  "port moody": "vancouver",
  "port coquitlam": "vancouver",
  coquitlam: "vancouver",
  "new westminster": "vancouver",
  "north vancouver": "vancouver",
  "west vancouver": "vancouver",
  surrey: "vancouver",
  langley: "vancouver",
  "maple ridge": "vancouver",
  "pitt meadows": "vancouver",
  delta: "vancouver",
  "white rock": "vancouver",
  abbotsford: "abbotsford",
  chilliwack: "abbotsford",
  mission: "abbotsford",
};

/** @deprecated Use cityToCraigslistHostname — kept for backwards-compatible imports. */
export function cityToCraigslistSlug(city: string): string {
  return cityToCraigslistHostname(city);
}

export function cityToCraigslistHostname(city: string): string {
  const normalized = city.trim().toLowerCase();
  return CITY_HOSTNAME_OVERRIDES[normalized] ?? normalized.replace(/\s+/g, "");
}

export function craigslistSearchPageUrl(hostname: string): string {
  return `https://${hostname}.craigslist.org/search/apa`;
}
