import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { INTERNAL_RENT_COMPS_LABEL } from "@/lib/leasing/internal-rent-comps";
import type { RentalAdAssistantInputs } from "@/lib/validation/rental-ad-assistant";
import {
  buildRentalAdAssistantMessages,
  buildRentalAdAssistantUserPrompt,
  RENTAL_AD_ASSISTANT_SYSTEM_PROMPT,
} from "./build-prompt";
import { generateRentalAdAssistantDraft } from "./generate-rental-ad-draft";
import {
  enforceConfidenceByCompCount,
  maxConfidenceForCompCount,
  normalizeRentalAdGeneratedRaw,
  parseRentalAdGeneratedOutput,
} from "./parse-output";
import type { GenerateRentalAdAssistantDraftInput } from "./types";

const sampleInputs: RentalAdAssistantInputs = {
  propertyType: "condo",
  bedrooms: 2,
  bathrooms: 1,
  sqft: 850,
  parking: "1 underground stall",
  utilitiesIncluded: ["water", "heat"],
  petPolicy: "Cats allowed",
  furnished: "unfurnished",
  availableDate: "2026-07-01",
  notes: "Corner unit with balcony",
  targetRentHint: 2400,
};

const baseContext = {
  property: {
    propertyId: "prop_1",
    addressDisplay: "123 Main Street",
    city: "Vancouver",
    province: "BC",
    postalCode: "V6B 1A1",
  },
  unit: {
    unitId: "unit_1",
    unitLabel: "Entire Property",
    bedrooms: 2,
  },
  inputs: sampleInputs,
  compsSnapshot: {
    label: INTERNAL_RENT_COMPS_LABEL,
    count: 2,
    median: 2350,
    min: 2200,
    max: 2500,
    samples: [
      {
        propertyDisplay: "456 Oak Street",
        bedrooms: 2,
        monthlyLeaseRent: 2350,
        leaseStartDate: "2025-03-01",
      },
    ],
    query: { city: "Vancouver", bedroomsMin: 1, bedroomsMax: 3, monthsBack: 24 },
  },
};

const validGeneratedOutput = {
  suggestedAdvertisingRent: {
    conservative: 2200,
    recommended: 2400,
    aggressive: 2550,
    currency: "CAD",
  },
  confidence: "high",
  confidenceReason: "Two portfolio comps and complete inputs.",
  explanation:
    "Suggested advertising rent only. Review before posting. Historical comps are signed lease rents.",
  headline: "Bright 2BR condo near transit",
  fullDescription: "Spacious 2-bedroom condo with balcony and underground parking.",
  shortDescription: "2BR condo, parking, available July 1.",
  valueAddSuggestions: ["Highlight recent paint if completed"],
  reviewFlags: [],
};

function buildGenerateInput(): GenerateRentalAdAssistantDraftInput {
  return {
    organizationId: "org_1",
    property: baseContext.property,
    unit: baseContext.unit,
    inputs: sampleInputs,
  };
}

type MockState = {
  tenancyRows: unknown[];
  writes: unknown[];
};

function createMockPrisma(state: MockState) {
  return {
    tenancy: {
      findMany: async () => state.tenancyRows,
      update: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("tenancy.update should not be called");
      },
      create: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("tenancy.create should not be called");
      },
    },
    property: {
      update: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("property.update should not be called");
      },
    },
    unit: {
      update: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("unit.update should not be called");
      },
    },
    rentalAdAssistantDraft: {
      update: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("rentalAdAssistantDraft.update should not be called");
      },
      create: async (args: unknown) => {
        state.writes.push(args);
        throw new Error("rentalAdAssistantDraft.create should not be called");
      },
    },
    get state() {
      return state;
    },
  };
}

describe("buildRentalAdAssistantMessages", () => {
  it("includes draft-only and non-official rent boundaries in the system prompt", () => {
    assert.match(RENTAL_AD_ASSISTANT_SYSTEM_PROMPT, /draft advertising guidance only/i);
    assert.match(RENTAL_AD_ASSISTANT_SYSTEM_PROMPT, /Tenancy\.monthlyRent/);
    assert.match(RENTAL_AD_ASSISTANT_SYSTEM_PROMPT, /Do not output monthlyRent/i);
    assert.match(RENTAL_AD_ASSISTANT_SYSTEM_PROMPT, /suggestedAdvertisingRent/i);
  });

  it("labels historical comps exactly in the user prompt", () => {
    const user = buildRentalAdAssistantUserPrompt(baseContext);
    assert.match(user, new RegExp(INTERNAL_RENT_COMPS_LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(user, /signed leases — not asking rents/i);
    assert.match(user, /monthlyLeaseRent: \$2350|2350 CAD lease start/);
  });

  it("instructs against unsupported utility and pet claims when not specified", () => {
    const user = buildRentalAdAssistantUserPrompt({
      ...baseContext,
      inputs: {
        ...sampleInputs,
        utilitiesIncluded: [],
        petPolicy: "",
      },
    });
    assert.match(user, /do not claim utilities are included/i);
    assert.match(user, /do not mention pets in ad copy/i);
  });
});

describe("parseRentalAdGeneratedOutput", () => {
  it("accepts valid AI JSON with suggestedAdvertisingRent tiers", () => {
    const parsed = parseRentalAdGeneratedOutput(validGeneratedOutput, 2);
    assert.equal(parsed.suggestedAdvertisingRent.recommended, 2400);
    assert.equal(parsed.suggestedAdvertisingRent.currency, "CAD");
    assert.equal("monthlyRent" in parsed, false);
    assert.equal(parsed.reviewFlags, undefined);
  });

  it("applies review flags from generated ad copy", () => {
    const parsed = parseRentalAdGeneratedOutput(
      {
        ...validGeneratedOutput,
        fullDescription: "Ideal for working professionals. Must be employed.",
      },
      2,
    );
    assert.ok(parsed.reviewFlags?.includes("working_professionals"));
    assert.ok(parsed.reviewFlags?.includes("must_be_employed"));
  });

  it("coerces string valueAddSuggestions from OpenAI output", () => {
    const parsed = parseRentalAdGeneratedOutput(
      {
        ...validGeneratedOutput,
        valueAddSuggestions: "Highlight recent paint",
      },
      2,
    );
    assert.deepEqual(parsed.valueAddSuggestions, ["Highlight recent paint"]);
  });

  it("normalizes confidence casing and cad currency", () => {
    const parsed = parseRentalAdGeneratedOutput(
      {
        ...validGeneratedOutput,
        confidence: "Medium",
        suggestedAdvertisingRent: {
          ...validGeneratedOutput.suggestedAdvertisingRent,
          currency: "cad",
        },
      },
      2,
    );
    assert.equal(parsed.confidence, "medium");
    assert.equal(parsed.suggestedAdvertisingRent.currency, "CAD");
  });

  it("rejects missing conservative/recommended/aggressive tiers", () => {
    assert.throws(
      () =>
        parseRentalAdGeneratedOutput(
          {
            ...validGeneratedOutput,
            suggestedAdvertisingRent: {
              conservative: 2200,
              recommended: 2400,
              currency: "CAD",
            },
          },
          0,
        ),
      /aggressive/i,
    );
  });

  it("rejects monthlyRent in AI output", () => {
    assert.throws(
      () =>
        normalizeRentalAdGeneratedRaw({
          monthlyRent: 2400,
          suggestedAdvertisingRent: validGeneratedOutput.suggestedAdvertisingRent,
        }),
      /suggestedAdvertisingRent/i,
    );
  });

  it("downgrades confidence to low when zero comps cannot be high", () => {
    const parsed = parseRentalAdGeneratedOutput(validGeneratedOutput, 0);
    assert.equal(parsed.confidence, "low");
    assert.match(parsed.confidenceReason, /capped at low/i);
  });

  it("downgrades confidence to medium when fewer than four comps cannot be high", () => {
    const parsed = parseRentalAdGeneratedOutput(validGeneratedOutput, 3);
    assert.equal(parsed.confidence, "medium");
    assert.match(parsed.confidenceReason, /capped at medium/i);
  });

  it("allows high confidence with four or more comps", () => {
    const parsed = parseRentalAdGeneratedOutput(validGeneratedOutput, 4);
    assert.equal(parsed.confidence, "high");
  });
});

describe("confidence helpers", () => {
  it("maps comp counts to maximum allowed confidence", () => {
    assert.equal(maxConfidenceForCompCount(0), "low");
    assert.equal(maxConfidenceForCompCount(2), "medium");
    assert.equal(maxConfidenceForCompCount(4), "high");
  });

  it("enforceConfidenceByCompCount leaves valid confidence unchanged", () => {
    const output = parseRentalAdGeneratedOutput(
      { ...validGeneratedOutput, confidence: "medium" },
      2,
    );
    const enforced = enforceConfidenceByCompCount(output, 2);
    assert.equal(enforced.confidence, "medium");
  });
});

describe("generateRentalAdAssistantDraft", () => {
  it("returns output and comps snapshot with mocked OpenAI and no Prisma writes", async () => {
    const state: MockState = {
      tenancyRows: [
        {
          monthlyRent: 2300,
          leaseStartDate: new Date("2025-04-01T00:00:00.000Z"),
          unit: { bedrooms: 2, unitNumber: "Upper" },
          property: {
            name: "789 Pine Street",
            streetLine1: "789 Pine Street",
            streetLine2: null,
            city: "Vancouver",
            organizationId: "org_1",
          },
        },
      ],
      writes: [],
    };
    const prisma = createMockPrisma(state);

    const result = await generateRentalAdAssistantDraft(
      prisma as unknown as PrismaClient,
      buildGenerateInput(),
      {
        createCompletion: async () => validGeneratedOutput,
      },
    );

    assert.equal(result.promptVersion, "rental-ad-assistant-v1");
    assert.equal(result.output.suggestedAdvertisingRent.recommended, 2400);
    assert.equal(result.compsSnapshot.label, INTERNAL_RENT_COMPS_LABEL);
    assert.equal(result.compsSnapshot.count, 1);
    assert.equal("monthlyRent" in result.output, false);
    assert.equal(state.writes.length, 0);

    const messages = buildRentalAdAssistantMessages({
      ...baseContext,
      compsSnapshot: result.compsSnapshot,
    });
    assert.match(messages.system, /Conservative suggested advertising rent/i);
  });
});
