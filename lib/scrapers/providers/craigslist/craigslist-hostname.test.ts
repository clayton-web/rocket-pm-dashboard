import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cityToCraigslistHostname,
  craigslistSearchPageUrl,
} from "./craigslist-hostname";

describe("craigslist hostname mapping", () => {
  it("maps Metro Vancouver cities to vancouver hostname", () => {
    assert.equal(cityToCraigslistHostname("Port Moody"), "vancouver");
    assert.equal(cityToCraigslistHostname("Burnaby"), "vancouver");
  });

  it("maps Fraser Valley cities to abbotsford hostname", () => {
    assert.equal(cityToCraigslistHostname("Abbotsford"), "abbotsford");
    assert.equal(cityToCraigslistHostname("Chilliwack"), "abbotsford");
    assert.equal(cityToCraigslistHostname("Mission"), "abbotsford");
  });

  it("builds search page URLs from hostname", () => {
    assert.equal(
      craigslistSearchPageUrl("vancouver"),
      "https://vancouver.craigslist.org/search/apa",
    );
  });
});
