import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { formatPropertyProfileTypeLabel } from "./profile";

describe("property profile helpers", () => {
  it("formats known property type labels", () => {
    assert.equal(formatPropertyProfileTypeLabel("condo"), "Condo");
    assert.equal(formatPropertyProfileTypeLabel("detached"), "Detached");
  });
});

describe("property detail profile UI", () => {
  it("displays and edits property profile on detail page", async () => {
    const detail = await readFile(
      new URL("../../components/properties/property-detail.tsx", import.meta.url),
      "utf8",
    );
    assert.match(detail, /PropertyProfileSection/);

    // The section itself now lives in the shared property editor, which Property Health also
    // links into.
    const section = await readFile(
      new URL(
        "../../components/properties/edit/property-profile-section.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(section, /Edit property profile/);
    assert.match(section, /updatePropertyProfileAction/);
    assert.match(section, /formatProfileSummary/);
  });
});

describe("add property profile UI", () => {
  it("includes optional profile fields on create form", async () => {
    const source = await readFile(
      new URL("../../components/properties/add-property-form.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /Rental profile \(optional\)/);
    assert.match(source, /propertyType/);
    assert.match(source, /approxSqft/);
  });
});
