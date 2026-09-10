import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPortfolioImportUnknownCity,
  isPortfolioImportUnknownPostal,
  PORTFOLIO_IMPORT_UNKNOWN_CITY,
  PORTFOLIO_IMPORT_UNKNOWN_POSTAL,
} from "@/lib/portfolio/parse-portfolio-address";
import {
  normalizeCanadianPostalCode,
  normalizePropertyCountry,
  normalizePropertyProvince,
  parsePropertyAddressDuplicateQuery,
  parsePropertyAddressFormInput,
  PROPERTY_PROVINCE_CODES,
} from "@/lib/validation/property-address";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    streetLine1: "123 Main St",
    streetLine2: null,
    city: "Vancouver",
    province: "BC",
    postalCode: "V6B 1A1",
    country: "CA",
    ...overrides,
  };
}

function ok(body: Record<string, unknown>) {
  const parsed = parsePropertyAddressFormInput(body);
  assert.ok(!("error" in parsed), `expected success, got ${JSON.stringify(parsed)}`);
  return parsed;
}

function err(body: Record<string, unknown>): string {
  const parsed = parsePropertyAddressFormInput(body);
  assert.ok("error" in parsed, `expected an error, got ${JSON.stringify(parsed)}`);
  return parsed.error;
}

describe("property address validation", () => {
  it("rejects a non-object body", () => {
    assert.equal(err("nope" as unknown as Record<string, unknown>), "Invalid form data");
    assert.deepEqual(parsePropertyAddressFormInput(null), { error: "Invalid form data" });
  });

  it("accepts a complete address unchanged", () => {
    assert.deepEqual(ok(valid()), {
      streetLine1: "123 Main St",
      streetLine2: null,
      city: "Vancouver",
      province: "BC",
      postalCode: "V6B 1A1",
      country: "CA",
    });
  });

  it("requires a street address", () => {
    assert.equal(err(valid({ streetLine1: "" })), "Street address is required");
    assert.equal(err(valid({ streetLine1: "   " })), "Street address is required");
    assert.equal(err(valid({ streetLine1: 42 })), "Street address is required");
  });

  it("trims and collapses repeated whitespace in the street address", () => {
    assert.equal(ok(valid({ streetLine1: "  123   Main    St  " })).streetLine1, "123 Main St");
  });

  it("rejects an over-long street address", () => {
    assert.equal(err(valid({ streetLine1: "a".repeat(301) })), "Street address is too long");
  });

  it("treats street line 2 as optional and empty as null", () => {
    assert.equal(ok(valid({ streetLine2: "" })).streetLine2, null);
    assert.equal(ok(valid({ streetLine2: "   " })).streetLine2, null);
    assert.equal(ok(valid({ streetLine2: undefined })).streetLine2, null);
    assert.equal(ok(valid({ streetLine2: "  Unit   2 " })).streetLine2, "Unit 2");
  });

  it("requires a city", () => {
    assert.equal(err(valid({ city: "" })), "City is required");
    assert.equal(ok(valid({ city: "  Maple   Ridge " })).city, "Maple Ridge");
  });

  it("rejects the import placeholder city that Property Health flags as missing", () => {
    const message = err(valid({ city: PORTFOLIO_IMPORT_UNKNOWN_CITY }));
    assert.match(message, /import placeholder/);
    // The parser and the health check must agree on what counts as a placeholder.
    assert.ok(isPortfolioImportUnknownCity(PORTFOLIO_IMPORT_UNKNOWN_CITY));
  });

  it("requires a postal code", () => {
    assert.equal(err(valid({ postalCode: "" })), "Postal code is required");
    assert.equal(err(valid({ postalCode: undefined })), "Postal code is required");
  });

  it("normalizes Canadian postal code formatting", () => {
    assert.equal(ok(valid({ postalCode: "v6b1a1" })).postalCode, "V6B 1A1");
    assert.equal(ok(valid({ postalCode: "  v6b  1a1 " })).postalCode, "V6B 1A1");
    assert.equal(ok(valid({ postalCode: "V6B-1A1" })).postalCode, "V6B 1A1");
  });

  it("rejects postal codes that are not Canadian format", () => {
    assert.match(err(valid({ postalCode: "98101" })), /Canadian postal code/);
    assert.match(err(valid({ postalCode: "V6B 1A" })), /Canadian postal code/);
    assert.match(err(valid({ postalCode: "1A1 V6B" })), /Canadian postal code/);
  });

  it("rejects the import placeholder postal code that Property Health flags as missing", () => {
    const message = err(valid({ postalCode: PORTFOLIO_IMPORT_UNKNOWN_POSTAL }));
    assert.match(message, /import placeholder/);
    assert.ok(isPortfolioImportUnknownPostal(PORTFOLIO_IMPORT_UNKNOWN_POSTAL));
    // Lower case and extra spacing must not sneak the placeholder through.
    assert.match(err(valid({ postalCode: " tbd  0t0 " })), /import placeholder/);
  });

  it("defaults province to BC and accepts every Canadian code", () => {
    assert.equal(ok(valid({ province: "" })).province, "BC");
    assert.equal(ok(valid({ province: undefined })).province, "BC");
    for (const code of PROPERTY_PROVINCE_CODES) {
      assert.equal(ok(valid({ province: code })).province, code);
    }
  });

  it("normalizes province long forms and casing", () => {
    assert.equal(ok(valid({ province: "british columbia" })).province, "BC");
    assert.equal(ok(valid({ province: "British Columbia" })).province, "BC");
    assert.equal(ok(valid({ province: "bc" })).province, "BC");
    assert.equal(ok(valid({ province: "Ontario" })).province, "ON");
  });

  it("rejects a province outside Canada", () => {
    assert.match(err(valid({ province: "WA" })), /Canadian province or territory/);
    assert.match(err(valid({ province: "Bavaria" })), /Canadian province or territory/);
  });

  it("defaults country to CA", () => {
    assert.equal(ok(valid({ country: "" })).country, "CA");
    assert.equal(ok(valid({ country: undefined })).country, "CA");
    assert.equal(ok(valid({ country: "ca" })).country, "CA");
    assert.equal(ok(valid({ country: "Canada" })).country, "CA");
  });

  it("rejects a non-Canadian country rather than storing an unvalidatable address", () => {
    assert.match(err(valid({ country: "US" })), /only Canadian addresses/);
  });

  it("exposes the normalizers used by the parser", () => {
    assert.equal(normalizeCanadianPostalCode("v6b1a1"), "V6B 1A1");
    assert.equal(normalizePropertyProvince("british columbia"), "BC");
    assert.equal(normalizePropertyCountry(undefined), "CA");
    assert.ok(typeof normalizeCanadianPostalCode("nope") === "object");
  });
});

describe("property address duplicate query", () => {
  it("accepts the placeholder-laden addresses the save parser rejects", () => {
    // This is the whole reason the lenient parser exists: an imported row still carrying
    // `Unknown` / `TBD 0T0` is the likeliest duplicate, and it is the row staff are repairing.
    const strict = parsePropertyAddressFormInput({
      streetLine1: "123 Main St",
      city: PORTFOLIO_IMPORT_UNKNOWN_CITY,
      postalCode: PORTFOLIO_IMPORT_UNKNOWN_POSTAL,
    });
    assert.ok("error" in strict);

    const lenient = parsePropertyAddressDuplicateQuery({
      streetLine1: "123 Main St",
      city: PORTFOLIO_IMPORT_UNKNOWN_CITY,
      postalCode: PORTFOLIO_IMPORT_UNKNOWN_POSTAL,
    });
    assert.deepEqual(lenient, {
      streetLine1: "123 Main St",
      streetLine2: null,
      city: PORTFOLIO_IMPORT_UNKNOWN_CITY,
      postalCode: PORTFOLIO_IMPORT_UNKNOWN_POSTAL,
    });
  });

  it("tolerates a half-typed postal code without going dark", () => {
    const query = parsePropertyAddressDuplicateQuery({
      streetLine1: "123 Main St",
      city: "Vancouver",
      postalCode: "v6b",
    });
    assert.equal(query?.postalCode, "V6B");
  });

  it("normalizes the same way the save parser does", () => {
    const query = parsePropertyAddressDuplicateQuery({
      streetLine1: "  123   Main   St ",
      streetLine2: "   ",
      city: "  Vancouver ",
      postalCode: " v6b 1a1 ",
    });
    assert.deepEqual(query, {
      streetLine1: "123 Main St",
      streetLine2: null,
      city: "Vancouver",
      postalCode: "V6B 1A1",
    });
  });

  it("reports nothing to compare rather than an error", () => {
    assert.equal(parsePropertyAddressDuplicateQuery(null), null);
    assert.equal(parsePropertyAddressDuplicateQuery("nope"), null);
    assert.equal(parsePropertyAddressDuplicateQuery({}), null);
    assert.equal(parsePropertyAddressDuplicateQuery({ streetLine1: "   " }), null);
    assert.equal(parsePropertyAddressDuplicateQuery({ streetLine1: 12 }), null);
  });

  it("caps absurdly long input instead of forwarding it to the database", () => {
    const query = parsePropertyAddressDuplicateQuery({ streetLine1: "a".repeat(5000) });
    assert.equal(query?.streetLine1.length, 300);
  });
});
