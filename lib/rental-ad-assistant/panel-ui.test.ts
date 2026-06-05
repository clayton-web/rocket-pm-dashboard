import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INTERNAL_RENT_COMPS_LABEL } from "@/lib/leasing/internal-rent-comps";
import { RENTAL_AD_ASSISTANT_DISCLAIMER } from "./draft-dto";
import {
  AGGRESSIVE_RENT_LABEL,
  buildRentalAdOutputFormState,
  CONFIDENCE_HELPER_TEXT,
  CONSERVATIVE_RENT_LABEL,
  formatRentalAdReviewFlagsForDisplay,
  hasRenderableRentalAdOutput,
  HISTORICAL_COMPS_HELPER_TEXT,
  RECOMMENDED_RENT_LABEL,
  rentalAdActionsAllowedWithReviewFlags,
  rentalAdGenerateUnavailableMessage,
  rentalAdHistoricalCompsLabel,
  rentalAdPanelShowsDisclaimer,
  rentalAdPanelShowsHistoricalCompsLabel,
  RENTAL_AD_REVIEW_BANNER_MESSAGE,
  shouldDisableRentalAdGenerate,
  shouldShowRentalAdReviewBanner,
  SUGGESTED_ADVERTISING_RENT_LABEL,
  SUGGESTED_RENT_HELPER_TEXT,
} from "./panel-ui";

describe("rental ad assistant panel UI copy", () => {
  it("renders the advertising disclaimer", () => {
    assert.equal(rentalAdPanelShowsDisclaimer(), RENTAL_AD_ASSISTANT_DISCLAIMER);
    assert.match(rentalAdPanelShowsDisclaimer(), /Suggested for advertising purposes only/i);
    assert.match(rentalAdPanelShowsDisclaimer(), /Not a lease rent/i);
  });

  it("labels suggested advertising rent tiers correctly", () => {
    assert.equal(SUGGESTED_ADVERTISING_RENT_LABEL, "Suggested advertising rent");
    assert.equal(CONSERVATIVE_RENT_LABEL, "Conservative");
    assert.equal(RECOMMENDED_RENT_LABEL, "Recommended");
    assert.equal(AGGRESSIVE_RENT_LABEL, "Aggressive");
  });

  it("shows historical comps label when comps exist", () => {
    assert.equal(rentalAdHistoricalCompsLabel(), INTERNAL_RENT_COMPS_LABEL);
    assert.equal(
      rentalAdPanelShowsHistoricalCompsLabel({
        id: "draft_1",
        unitId: "unit_1",
        propertyId: "prop_1",
        inputs: null,
        output: null,
        compsSnapshot: {
          label: INTERNAL_RENT_COMPS_LABEL,
          count: 2,
          median: 2400,
          min: 2200,
          max: 2600,
          samples: [],
          query: { city: "Vancouver", bedroomsMin: 1, bedroomsMax: 3 },
        },
        model: null,
        promptVersion: null,
        lastGeneratedAt: null,
        updatedAt: "2026-06-01T00:00:00.000Z",
      }),
      true,
    );
    assert.equal(rentalAdPanelShowsHistoricalCompsLabel(null), false);
  });

  it("disables generate when OpenAI is missing", () => {
    assert.equal(shouldDisableRentalAdGenerate(false), true);
    assert.equal(shouldDisableRentalAdGenerate(true), false);
    assert.match(rentalAdGenerateUnavailableMessage(false) ?? "", /OPENAI_API_KEY/);
    assert.equal(rentalAdGenerateUnavailableMessage(true), null);
  });

  it("shows amber review banner when review flags exist", () => {
    assert.equal(shouldShowRentalAdReviewBanner(["no_children"]), true);
    assert.equal(shouldShowRentalAdReviewBanner([]), false);
    assert.equal(shouldShowRentalAdReviewBanner(undefined), false);
    assert.match(RENTAL_AD_REVIEW_BANNER_MESSAGE, /fair housing/i);
    const labels = formatRentalAdReviewFlagsForDisplay(["no_children", "must_be_employed"]);
    assert.equal(labels.length, 2);
    assert.match(labels[0], /children/i);
    assert.match(labels[1], /income/i);
  });

  it("does not block copy or save when review flags exist", () => {
    assert.equal(rentalAdActionsAllowedWithReviewFlags(), true);
  });

  it("coerces non-array value-add suggestions for form display", () => {
    const formState = buildRentalAdOutputFormState({
      suggestedAdvertisingRent: {
        conservative: 2200,
        recommended: 2400,
        aggressive: 2550,
        currency: "CAD",
      },
      confidence: "low",
      confidenceReason: "Limited comps.",
      explanation: "Suggested advertising rent only.",
      headline: "Bright condo",
      fullDescription: "Full copy.",
      shortDescription: "Short copy.",
      valueAddSuggestions: "Highlight balcony",
    } as never);
    assert.equal(formState.valueAddSuggestions, "Highlight balcony");
  });

  it("guards output rendering when rent tiers are missing", () => {
    assert.equal(hasRenderableRentalAdOutput(null), false);
    assert.equal(
      hasRenderableRentalAdOutput({
        suggestedAdvertisingRent: {
          conservative: 2200,
          recommended: 2400,
          aggressive: 2550,
          currency: "CAD",
        },
        confidence: "low",
        confidenceReason: "x",
        explanation: "x",
        headline: "x",
        fullDescription: "x",
        shortDescription: "x",
        valueAddSuggestions: [],
      }),
      true,
    );
  });

  it("distinguishes suggested rent, historical comps, and confidence with hardened labels", () => {
    assert.match(SUGGESTED_RENT_HELPER_TEXT, /not official lease rent/i);
    assert.match(HISTORICAL_COMPS_HELPER_TEXT, /signed lease amounts/i);
    assert.match(CONFIDENCE_HELPER_TEXT, /not a market guarantee/i);
    assert.doesNotMatch(SUGGESTED_ADVERTISING_RENT_LABEL, /monthly rent|market rent|official rent/i);
    assert.doesNotMatch(CONSERVATIVE_RENT_LABEL, /lease rent|asking rent/i);
    assert.doesNotMatch(rentalAdHistoricalCompsLabel(), /asking rent|market rent/i);
  });
});
