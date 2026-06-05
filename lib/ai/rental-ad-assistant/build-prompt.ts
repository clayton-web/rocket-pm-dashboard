import { INTERNAL_RENT_COMPS_LABEL } from "@/lib/leasing/internal-rent-comps";
import type { RentalAdAssistantCompsSnapshot, RentalAdAssistantInputs } from "@/lib/validation/rental-ad-assistant";
import type {
  RentalAdAssistantPropertyContext,
  RentalAdAssistantUnitContext,
} from "./types";

export const RENTAL_AD_ASSISTANT_SYSTEM_PROMPT = `You help British Columbia property management staff prepare draft rental advertisements and suggested advertising rent ranges.

This is draft advertising guidance only — not a lease rent, appraisal, market guarantee, or official rent recommendation. Official lease rent is entered separately in Rocket PM as Tenancy.monthlyRent when a tenancy is created.

Rules:
1. Output draft advertising guidance only. Never present rent as guaranteed, appraised, or official.
2. Use only amenities and features explicitly provided in the input. Do not invent inclusions, renovations, views, appliances, or neighbourhood claims.
3. Use clear BC/Canada rental wording suitable for property managers.
4. Avoid discriminatory language under BC Human Rights principles. Do not prefer or exclude tenants by family status, age, source of income, religion, disability, or similar grounds.
5. Never use tenant-preference phrases such as "professionals only," "no children," "ideal for singles," "perfect for young couple," "quiet mature tenants," or similar.
6. If pet policy is blank or unknown, do not mention pets in ad copy.
7. If utilities included list is empty, do not claim utilities are included.
8. Keep headline, fullDescription, and shortDescription practical and copy-paste ready for external listing sites.
9. Put the review disclaimer in explanation only — not inside headline, fullDescription, or shortDescription.
10. When historical portfolio comps are provided, describe them as signed historical lease rents — not current asking rents or guarantees.

Rent framing — use exactly these concepts in your JSON:
- suggestedAdvertisingRent.conservative (Conservative suggested advertising rent)
- suggestedAdvertisingRent.recommended (Recommended suggested advertising rent)
- suggestedAdvertisingRent.aggressive (Aggressive suggested advertising rent)
- currency must be "CAD"

Do not output monthlyRent, askingRent, lease rent, or official rent fields.

Return a single JSON object with keys:
suggestedAdvertisingRent, confidence (high | medium | low), confidenceReason, explanation, headline, fullDescription, shortDescription, valueAddSuggestions (string array), reviewFlags (optional string array).`;

export type RentalAdAssistantPromptContext = {
  property: RentalAdAssistantPropertyContext;
  unit: RentalAdAssistantUnitContext;
  inputs: RentalAdAssistantInputs;
  compsSnapshot: RentalAdAssistantCompsSnapshot;
};

function formatInputsForPrompt(inputs: RentalAdAssistantInputs): string {
  const lines = [
    `- Property type: ${inputs.propertyType}`,
    `- Bedrooms: ${inputs.bedrooms}`,
    `- Bathrooms: ${inputs.bathrooms}`,
    `- Approximate sqft: ${inputs.sqft}`,
    `- Parking: ${inputs.parking}`,
    `- Utilities included: ${inputs.utilitiesIncluded.length ? inputs.utilitiesIncluded.join(", ") : "(none specified — do not claim utilities are included)"}`,
    `- Pet policy: ${inputs.petPolicy.trim() ? inputs.petPolicy : "(not specified — do not mention pets in ad copy)"}`,
    `- Furnished: ${inputs.furnished}`,
    `- Available date: ${inputs.availableDate}`,
  ];
  if (inputs.notes?.trim()) {
    lines.push(`- Notes/features: ${inputs.notes.trim()}`);
  }
  if (inputs.targetRentHint !== undefined) {
    lines.push(
      `- PM target advertising hint (not official rent): $${inputs.targetRentHint} CAD`,
    );
  }
  return lines.join("\n");
}

function formatCompsForPrompt(comps: RentalAdAssistantCompsSnapshot): string {
  const lines = [
    `Label: ${INTERNAL_RENT_COMPS_LABEL}`,
    `Count: ${comps.count}`,
    `Median historical lease rent: ${comps.median ?? "n/a"}`,
    `Range: ${comps.min ?? "n/a"} – ${comps.max ?? "n/a"} CAD`,
    "Samples (signed leases — not asking rents):",
  ];
  if (comps.samples.length === 0) {
    lines.push("- (no portfolio comps matched this query)");
  } else {
    for (const sample of comps.samples) {
      lines.push(
        `- ${sample.propertyDisplay} · ${sample.bedrooms ?? "?"} bed · $${sample.monthlyLeaseRent} CAD lease start ${sample.leaseStartDate}`,
      );
    }
  }
  lines.push(
    "Explain in your output that these are historical signed lease rents from the portfolio, not current asking rents or guarantees.",
  );
  return lines.join("\n");
}

export function buildRentalAdAssistantUserPrompt(ctx: RentalAdAssistantPromptContext): string {
  const unitBedrooms =
    ctx.unit.bedrooms != null
      ? String(ctx.unit.bedrooms)
      : "(not recorded on unit — use PM input bedrooms only)";

  return [
    "## Property",
    `- Address: ${ctx.property.addressDisplay}`,
    `- City: ${ctx.property.city}`,
    `- Province: ${ctx.property.province}`,
    `- Postal code: ${ctx.property.postalCode}`,
    "",
    "## Unit",
    `- Unit label: ${ctx.unit.unitLabel}`,
    `- Unit bedrooms on file: ${unitBedrooms}`,
    "",
    "## PM draft ad inputs (source of truth for features — do not invent beyond this)",
    formatInputsForPrompt(ctx.inputs),
    "",
    `## ${INTERNAL_RENT_COMPS_LABEL}`,
    formatCompsForPrompt(ctx.compsSnapshot),
    "",
    "Generate suggested advertising rent (Conservative / Recommended / Aggressive), confidence, explanation with review disclaimer, headline, full ad copy, short ad copy, and value-add suggestions.",
  ].join("\n");
}

export function buildRentalAdAssistantMessages(ctx: RentalAdAssistantPromptContext): {
  system: string;
  user: string;
} {
  return {
    system: RENTAL_AD_ASSISTANT_SYSTEM_PROMPT,
    user: buildRentalAdAssistantUserPrompt(ctx),
  };
}
