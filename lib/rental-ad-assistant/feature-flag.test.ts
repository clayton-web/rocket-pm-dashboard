import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isRentalAdAssistantEnabled } from "./feature-flag";

describe("isRentalAdAssistantEnabled", () => {
  const original = process.env.RENTAL_AD_ASSISTANT_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.RENTAL_AD_ASSISTANT_ENABLED;
    else process.env.RENTAL_AD_ASSISTANT_ENABLED = original;
  });

  it("defaults to false when unset", () => {
    delete process.env.RENTAL_AD_ASSISTANT_ENABLED;
    assert.equal(isRentalAdAssistantEnabled(), false);
  });

  it("returns true only for explicit truthy values", () => {
    process.env.RENTAL_AD_ASSISTANT_ENABLED = "true";
    assert.equal(isRentalAdAssistantEnabled(), true);

    process.env.RENTAL_AD_ASSISTANT_ENABLED = "1";
    assert.equal(isRentalAdAssistantEnabled(), true);

    process.env.RENTAL_AD_ASSISTANT_ENABLED = "yes";
    assert.equal(isRentalAdAssistantEnabled(), true);
  });

  it("returns false for false and other values", () => {
    process.env.RENTAL_AD_ASSISTANT_ENABLED = "false";
    assert.equal(isRentalAdAssistantEnabled(), false);

    process.env.RENTAL_AD_ASSISTANT_ENABLED = "0";
    assert.equal(isRentalAdAssistantEnabled(), false);
  });
});
