export type ListingCopyScanInput = {
  headline?: string;
  fullDescription?: string;
  shortDescription?: string;
};

const LISTING_COPY_PATTERNS: { flag: string; pattern: RegExp }[] = [
  { flag: "professionals_only", pattern: /\bprofessionals only\b/i },
  { flag: "working_professionals", pattern: /\bworking professionals?\b/i },
  { flag: "no_children", pattern: /\bno children\b/i },
  { flag: "adults_only", pattern: /\badults only\b/i },
  { flag: "single_person_only", pattern: /\bsingle person only\b/i },
  { flag: "ideal_for_singles", pattern: /\bideal for singles?\b/i },
  { flag: "young_couple", pattern: /\byoung couple\b/i },
  { flag: "quiet_couple_only", pattern: /\bquiet couple only\b/i },
  { flag: "students_only", pattern: /\bstudents only\b/i },
  { flag: "no_students", pattern: /\bno students\b/i },
  { flag: "christian_only", pattern: /\bchristian (household|family|tenants? only)\b/i },
  { flag: "muslim_only", pattern: /\bmuslim (household|family|tenants? only)\b/i },
  { flag: "religious_preference", pattern: /\b(religious|faith[- ]based) (household|tenants? only)\b/i },
  { flag: "nationality_preference", pattern: /\b(no |only )?(canadian|chinese|indian|filipino) (tenants?|renters?)\b/i },
  { flag: "ethnicity_preference", pattern: /\b(no |only )?(white|asian|black) (tenants?|renters?)\b/i },
  { flag: "disability_exclusion", pattern: /\bno (wheelchair|disabled|disabilit(?:y|ies))\b/i },
  { flag: "must_be_employed", pattern: /\bmust be employed\b/i },
  { flag: "employment_required", pattern: /\bemployment required\b/i },
  { flag: "income_employed_only", pattern: /\b(employed|employment) (only|required)\b/i },
  { flag: "mature_tenants_only", pattern: /\b(mature|quiet) (tenants?|renters?) only\b/i },
];

export const LISTING_REVIEW_FLAG_LABELS: Record<string, string> = {
  professionals_only: "Phrase may prefer certain tenants (professionals only)",
  working_professionals: "Phrase may prefer certain tenants (working professionals)",
  no_children: "Phrase may exclude families with children",
  adults_only: "Phrase may exclude families with children (adults only)",
  single_person_only: "Phrase may exclude couples or families",
  ideal_for_singles: "Phrase may exclude couples or families",
  young_couple: "Phrase may prefer certain household types",
  quiet_couple_only: "Phrase may prefer certain household types",
  students_only: "Phrase may prefer or exclude students",
  no_students: "Phrase may prefer or exclude students",
  christian_only: "Phrase may indicate religious preference",
  muslim_only: "Phrase may indicate religious preference",
  religious_preference: "Phrase may indicate religious preference",
  nationality_preference: "Phrase may indicate nationality preference",
  ethnicity_preference: "Phrase may indicate ethnicity preference",
  disability_exclusion: "Phrase may exclude people with disabilities",
  must_be_employed: "Phrase may exclude lawful income sources (must be employed)",
  employment_required: "Phrase may exclude lawful income sources (employment required)",
  income_employed_only: "Phrase may exclude lawful income sources",
  mature_tenants_only: "Phrase may prefer certain age groups",
};

/** Returns sorted unique review flag keys — warnings only, never blocks save/generate. */
export function scanListingCopyForReview(input: ListingCopyScanInput): string[] {
  const blob = [input.headline, input.fullDescription, input.shortDescription]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n");

  if (!blob.trim()) return [];

  const flags = new Set<string>();
  for (const { flag, pattern } of LISTING_COPY_PATTERNS) {
    if (pattern.test(blob)) {
      flags.add(flag);
    }
  }
  return Array.from(flags).sort();
}

export function formatListingReviewFlag(flag: string): string {
  return LISTING_REVIEW_FLAG_LABELS[flag] ?? `Review suggested wording (${flag.replaceAll("_", " ")})`;
}
