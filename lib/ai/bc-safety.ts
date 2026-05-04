const SENSITIVE_PATTERNS: { flag: string; pattern: RegExp }[] = [
  { flag: "eviction", pattern: /\bevict\b|eviction|notice to end tenancy|10\s*day|one month notice|two month notice/i },
  { flag: "non_payment", pattern: /\brent arrears\b|non[- ]payment|late rent|NSF|overdue rent/i },
  { flag: "deposit", pattern: /\bsecurity deposit\b|\bdeposit return\b|damage deposit/i },
  { flag: "repairs_access", pattern: /\bunauthorized entry\b|illegal entry|lock.?out|repair.*access|entry without notice/i },
  { flag: "strata", pattern: /\bstrata\b|condo corporation|CSFS\b/i },
  { flag: "human_rights", pattern: /\bhuman rights\b|discrimination|accommodation request|duty to accommodate/i },
  { flag: "legal_counsel", pattern: /\blawyer\b|legal advice|litigation|small claims|RTB\b|residential tenancy branch/i },
  { flag: "owner_tenant_dispute", pattern: /\bdispute\b.*\b(tenant|landlord)\b|breach of tenancy/i },
];

export function scanTextForSensitivity(text: string): string[] {
  const lower = text.toLowerCase();
  const flags = new Set<string>();
  for (const { flag, pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(lower)) {
      flags.add(flag);
    }
  }
  return Array.from(flags).sort();
}

export function mergeSensitivityFlags(modelFlags: unknown, heuristicFlags: string[]): string[] {
  const fromModel = Array.isArray(modelFlags)
    ? modelFlags.filter((x): x is string => typeof x === "string")
    : [];
  return Array.from(new Set([...fromModel, ...heuristicFlags])).sort();
}

export function shouldForceReview(flags: string[]): boolean {
  return flags.length > 0;
}
