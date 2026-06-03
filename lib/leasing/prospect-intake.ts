/** Controlled vocabulary for public viewing-request intake. */
export const HOUSEHOLD_INCOME_RANGES = [
  "under_3000",
  "3000_4999",
  "5000_7499",
  "7500_9999",
  "10000_plus",
  "prefer_not_to_say",
] as const;

export type HouseholdIncomeRange = (typeof HOUSEHOLD_INCOME_RANGES)[number];

export const SMOKER_STATUSES = [
  "non_smoker",
  "smoker",
  "occasional",
  "prefer_not_to_say",
] as const;

export type SmokerStatus = (typeof SMOKER_STATUSES)[number];

const INCOME_RANGE_SET = new Set<string>(HOUSEHOLD_INCOME_RANGES);
const SMOKER_STATUS_SET = new Set<string>(SMOKER_STATUSES);

export function formatHouseholdIncomeRange(value: string): string {
  switch (value) {
    case "under_3000":
      return "Under $3,000 / month";
    case "3000_4999":
      return "$3,000 – $4,999";
    case "5000_7499":
      return "$5,000 – $7,499";
    case "7500_9999":
      return "$7,500 – $9,999";
    case "10000_plus":
      return "$10,000+";
    case "prefer_not_to_say":
      return "Prefer not to say";
    default:
      return value;
  }
}

export function formatSmokerStatus(value: string): string {
  switch (value) {
    case "non_smoker":
      return "Non-smoker";
    case "smoker":
      return "Smoker";
    case "occasional":
      return "Occasional";
    case "prefer_not_to_say":
      return "Prefer not to say";
    default:
      return value;
  }
}

export function isValidHouseholdIncomeRange(value: string): value is HouseholdIncomeRange {
  return INCOME_RANGE_SET.has(value);
}

export function isValidSmokerStatus(value: string): value is SmokerStatus {
  return SMOKER_STATUS_SET.has(value);
}
