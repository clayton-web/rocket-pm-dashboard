import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  PORTFOLIO_HEALTH_EDIT_TARGETS,
  PROPERTY_EDIT_FIELDS,
  PROPERTY_EDIT_SECTIONS,
  propertyEditSectionAnchor,
} from "@/lib/property/portfolio-health-edit-targets";

/**
 * Source-scan coverage, the repository's convention for presentation with no DOM harness.
 *
 * The point of these checks is the extraction contract: there is one property editor, Property
 * Detail renders it, Property Health links into it, and a targeted Fix lands on a control that
 * genuinely exists. Behaviour that can be tested for real lives in the pure modules.
 */
function read(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const address = () => read("./property-address-section.tsx");
const ownerStrata = () => read("./property-owner-strata-section.tsx");
const profile = () => read("./property-profile-section.tsx");
const statusSection = () => read("./property-status-section.tsx");
const controls = () => read("./edit-controls.tsx");
const cleanupActions = () => read("./health-cleanup-actions.tsx");
const propertyDetail = () => read("../property-detail.tsx");
const healthEditActions = () => read("../health/health-edit-actions.tsx");

describe("property edit section extraction", () => {
  it("removed the inline edit sections from property-detail", async () => {
    const text = await propertyDetail();
    for (const inlined of [
      "function PropertyStatusSection",
      "function PropertyProfileSection",
      "function PropertyOwnerStrataSection",
    ]) {
      assert.ok(!text.includes(inlined), `${inlined} must live in components/properties/edit/`);
    }
  });

  it("has property-detail render the extracted sections", async () => {
    const text = await propertyDetail();
    for (const section of [
      "PropertyAddressSection",
      "PropertyStatusSection",
      "PropertyProfileSection",
      "PropertyOwnerStrataSection",
    ]) {
      assert.match(text, new RegExp(`from "@/components/properties/edit/`));
      assert.match(text, new RegExp(`<${section}`), `${section} is not rendered`);
    }
  });

  it("keeps the write actions out of property-detail", async () => {
    const text = await propertyDetail();
    // The remaining actions belong to units and deletion, which were not extracted.
    for (const action of [
      "updatePropertyAddressAction",
      "updatePropertyProfileAction",
      "updatePropertyOwnerStrataAction",
      "updatePropertyServiceRelationshipAction",
    ]) {
      assert.ok(!text.includes(action), `${action} moved with its section`);
    }
  });

  it("submits each section through the existing property server action", async () => {
    assert.match(await address(), /updatePropertyAddressAction\(propertyId, currentValues\(\)\)/);
    assert.match(await ownerStrata(), /updatePropertyOwnerStrataAction\(propertyId, \{/);
    assert.match(await profile(), /updatePropertyProfileAction\(propertyId, \{/);
    assert.match(await statusSection(), /updatePropertyServiceRelationshipAction\(propertyId, \{/);
  });

  it("preserves the original save state machine in every section", async () => {
    for (const source of [await address(), await ownerStrata(), await profile(), await statusSection()]) {
      assert.match(source, /useTransition\(\)/);
      assert.match(source, /if \(!result\.ok\)|if \(!\(await/);
      assert.match(source, /router\.refresh\(\)/);
      assert.match(source, /<InlineNotice/);
    }
  });

  it("gives every section a deep-link anchor", async () => {
    const sources: Record<string, string> = {
      address: await address(),
      "owner-strata": await ownerStrata(),
      profile: await profile(),
      status: await statusSection(),
    };
    for (const section of PROPERTY_EDIT_SECTIONS) {
      const source = sources[section];
      assert.ok(source, `no source registered for section ${section}`);
      assert.match(source, new RegExp(`usePropertyEditSection\\("${section}"\\)`));
      assert.match(source, /id=\{anchorId\}/);
    }
    assert.match(await controls(), /propertyEditSectionAnchor\(section\)/);
    assert.equal(propertyEditSectionAnchor("address"), "edit-address");
  });

  it("renders a control for every field a Fix action targets", async () => {
    const sources: Record<string, string> = {
      address: await address(),
      "owner-strata": await ownerStrata(),
      profile: await profile(),
      status: await statusSection(),
    };

    for (const [issueKey, target] of Object.entries(PORTFOLIO_HEALTH_EDIT_TARGETS)) {
      if (target.kind !== "property" || !target.field) continue;
      const source = sources[target.section]!;
      const fieldKey = Object.entries(PROPERTY_EDIT_FIELDS).find(
        ([, value]) => value === target.field,
      )?.[0];
      assert.ok(fieldKey, `${target.field} is not in PROPERTY_EDIT_FIELDS`);
      // The id is what `document.getElementById(focusField)` resolves, so it must be the
      // canonical field name and not a generated `useId()` value.
      assert.match(
        source,
        new RegExp(`id=\\{PROPERTY_EDIT_FIELDS\\.${fieldKey}\\}`),
        `${issueKey} targets ${target.field} but ${target.section} does not render that id`,
      );
    }
  });

  it("edits all six address fields with the canonical ids", async () => {
    const text = await address();
    for (const field of [
      "streetLine1",
      "streetLine2",
      "city",
      "province",
      "postalCode",
      "country",
    ] as const) {
      assert.match(text, new RegExp(`id=\\{PROPERTY_EDIT_FIELDS\\.${field}\\}`));
      assert.match(text, new RegExp(`name=\\{PROPERTY_EDIT_FIELDS\\.${field}\\}`));
    }
  });

  it("focuses a targeted field once and does not trap focus", async () => {
    const text = await controls();
    assert.match(text, /parsePropertyEditSectionFromHash\(window\.location\.hash\)/);
    assert.match(text, /parseHealthFocusField/);
    assert.match(text, /setFocusField\(null\);/);
    assert.match(text, /target\.focus\(\)/);
    // No focus loop, no focus containment.
    assert.ok(!text.includes("preventDefault"));
    assert.ok(!text.includes("Tab"));
  });

  it("warns without blocking on active tenancy and duplicates", async () => {
    const text = await address();
    assert.match(text, /hasActiveTenancy \? \(/);
    assert.match(text, /active tenancy/);
    assert.match(text, /already generated keep the address they were produced with/);
    assert.match(text, /PROPERTY_ADDRESS_DUPLICATE_WARNING/);
    assert.match(text, /Saving is still allowed/);

    // Neither warning may gate the submit control.
    assert.doesNotMatch(text, /disabled=\{[^}]*hasActiveTenancy/);
    assert.doesNotMatch(text, /disabled=\{[^}]*duplicates/);
    assert.doesNotMatch(text, /if \(duplicates\.length[^)]*\) return/);
  });

  it("checks duplicates off the save path and discards stale replies", async () => {
    const text = await address();
    assert.match(text, /checkPropertyAddressDuplicatesAction/);
    assert.match(text, /setTimeout\(/);
    assert.match(text, /if \(sequence !== checkSequence\.current\) return;/);
    // The save path calls only the write action.
    assert.match(text, /async function saveAddress\(\)/);
    const saveBody = text.slice(text.indexOf("async function saveAddress()"));
    assert.ok(!saveBody.slice(0, 400).includes("checkPropertyAddressDuplicatesAction"));
  });

  it("shares one cleanup-loop implementation across the editable sections", async () => {
    const actions = await cleanupActions();
    assert.match(actions, /buildHealthReturnUrl\(context\)/);
    assert.match(actions, /buildHealthReturnUrl\(context, \{ cleanupDone: "1" \}\)/);
    assert.match(actions, /resolveNextHealthCleanupPropertyAction/);
    assert.match(actions, /if \(!\(await save\(\)\)\) return;/);

    for (const source of [await address(), await ownerStrata()]) {
      assert.match(source, /<HealthCleanupActions/);
      assert.match(source, /healthContext \? \(/);
      // Neither section reimplements the navigation.
      assert.ok(!source.includes("buildHealthReturnUrl"));
    }
  });

  it("renders the cleanup controls only when opened from Property Health", async () => {
    for (const source of [await address(), await ownerStrata()]) {
      assert.match(source, /healthContext: HealthViewState \| null|healthContext\?: HealthViewState \| null/);
    }
    assert.match(await propertyDetail(), /healthContext=\{healthContext\}/);
  });

  it("hides the editor entirely from viewers without write access", async () => {
    for (const source of [await address(), await ownerStrata(), await profile(), await statusSection()]) {
      assert.match(source, /\{canEdit \? \(/);
    }
  });

  it("keeps Property Health out of the editor implementation", async () => {
    const text = await healthEditActions();
    assert.match(text, /buildHealthEditPropertyHref/);
    assert.ok(!text.includes("PropertyAddressSection"));
    assert.ok(!text.includes("updatePropertyAddressAction"));
  });
});
