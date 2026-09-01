import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPropertyLevelMissingKey,
  isUnitLevelMissingKey,
  PORTFOLIO_HEALTH_MISSING_LABELS,
  type PortfolioHealthMissingItemKey,
} from "@/lib/property/portfolio-health";
import {
  PORTFOLIO_HEALTH_EDIT_TARGETS,
  parsePropertyEditSection,
  parsePropertyEditSectionFromHash,
  portfolioHealthEditTarget,
  portfolioHealthPropertyEditTarget,
  PROPERTY_EDIT_FIELDS,
  PROPERTY_EDIT_SECTIONS,
  propertyEditSectionAnchor,
} from "@/lib/property/portfolio-health-edit-targets";

const ALL_KEYS = Object.keys(PORTFOLIO_HEALTH_MISSING_LABELS) as PortfolioHealthMissingItemKey[];

describe("portfolio health edit targets", () => {
  it("resolves every health issue key to a target", () => {
    assert.ok(ALL_KEYS.length > 0);
    for (const key of ALL_KEYS) {
      assert.ok(
        PORTFOLIO_HEALTH_EDIT_TARGETS[key],
        `issue key ${key} has no edit target — it would render a Fix that goes nowhere`,
      );
    }
  });

  it("carries no target for an unknown issue key", () => {
    assert.equal(
      PORTFOLIO_HEALTH_EDIT_TARGETS["not_a_key" as PortfolioHealthMissingItemKey],
      undefined,
    );
  });

  it("routes address issues to the address section and the field that is wrong", () => {
    assert.deepEqual(portfolioHealthEditTarget("property_address"), {
      kind: "property",
      section: "address",
      field: PROPERTY_EDIT_FIELDS.streetLine1,
    });
    assert.deepEqual(portfolioHealthEditTarget("missing_city"), {
      kind: "property",
      section: "address",
      field: PROPERTY_EDIT_FIELDS.city,
    });
    assert.deepEqual(portfolioHealthEditTarget("missing_postal_code"), {
      kind: "property",
      section: "address",
      field: PROPERTY_EDIT_FIELDS.postalCode,
    });
  });

  it("routes owner and strata issues to the owner/strata section", () => {
    assert.deepEqual(portfolioHealthEditTarget("owner_contact"), {
      kind: "property",
      section: "owner-strata",
      field: PROPERTY_EDIT_FIELDS.ownerEmail,
    });
    assert.deepEqual(portfolioHealthEditTarget("strata_notes"), {
      kind: "property",
      section: "owner-strata",
      field: PROPERTY_EDIT_FIELDS.strataNotes,
    });
  });

  it("keeps documents on the existing document workflow", () => {
    assert.deepEqual(portfolioHealthEditTarget("documents"), { kind: "documents" });
    assert.equal(portfolioHealthPropertyEditTarget("documents"), null);
  });

  it("keeps every tenant, rent and lease issue on the tenancy workflow", () => {
    const tenantKeys = ALL_KEYS.filter(isUnitLevelMissingKey);
    assert.ok(tenantKeys.length >= 8);
    for (const key of tenantKeys) {
      assert.deepEqual(
        portfolioHealthEditTarget(key),
        { kind: "tenancy" },
        `${key} is unit-level and must stay in the tenancy editor`,
      );
      assert.equal(portfolioHealthPropertyEditTarget(key), null);
    }
  });

  it("never routes a unit-level issue into the property editor", () => {
    for (const key of ALL_KEYS) {
      if (portfolioHealthEditTarget(key).kind !== "property") continue;
      assert.ok(
        isPropertyLevelMissingKey(key),
        `${key} opens the property editor but is not a property-level issue`,
      );
    }
  });

  it("targets only sections that exist", () => {
    for (const key of ALL_KEYS) {
      const target = portfolioHealthEditTarget(key);
      if (target.kind !== "property") continue;
      assert.ok(
        PROPERTY_EDIT_SECTIONS.includes(target.section),
        `${key} targets unknown section ${target.section}`,
      );
    }
  });

  it("targets only fields declared in the field contract", () => {
    const fields = new Set<string>(Object.values(PROPERTY_EDIT_FIELDS));
    for (const key of ALL_KEYS) {
      const target = portfolioHealthEditTarget(key);
      if (target.kind !== "property" || !target.field) continue;
      assert.ok(fields.has(target.field), `${key} targets unknown field ${target.field}`);
    }
  });

  it("does not restate issue labels", () => {
    // Fix affordances read their wording from PORTFOLIO_HEALTH_MISSING_LABELS; a second copy here
    // would let the two drift.
    const source = JSON.stringify(PORTFOLIO_HEALTH_EDIT_TARGETS);
    for (const label of Object.values(PORTFOLIO_HEALTH_MISSING_LABELS)) {
      assert.ok(!source.includes(label), `edit targets duplicate the label "${label}"`);
    }
  });

  it("round trips a section through its anchor", () => {
    for (const section of PROPERTY_EDIT_SECTIONS) {
      const anchor = propertyEditSectionAnchor(section);
      assert.equal(anchor, `edit-${section}`);
      assert.equal(parsePropertyEditSectionFromHash(`#${anchor}`), section);
      assert.equal(parsePropertyEditSectionFromHash(anchor), section);
    }
  });

  it("ignores hashes that are not an edit anchor", () => {
    assert.equal(parsePropertyEditSectionFromHash("#documents"), null);
    assert.equal(parsePropertyEditSectionFromHash("#edit-tenancy"), null);
    assert.equal(parsePropertyEditSectionFromHash("#edit-"), null);
    assert.equal(parsePropertyEditSectionFromHash(""), null);
    assert.equal(parsePropertyEditSectionFromHash(null), null);
    assert.equal(parsePropertyEditSectionFromHash("#edit-address; drop"), null);
  });

  it("parses section names case-insensitively and rejects unknown ones", () => {
    assert.equal(parsePropertyEditSection("ADDRESS"), "address");
    assert.equal(parsePropertyEditSection(" owner-strata "), "owner-strata");
    assert.equal(parsePropertyEditSection("tenancy"), null);
    assert.equal(parsePropertyEditSection(undefined), null);
  });
});
