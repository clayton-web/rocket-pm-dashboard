import { mapCraigslistSearchPayload } from "../providers/craigslist/craigslist-mapper";
import type { RawScraperListing } from "../types";

/** Sample Craigslist-shaped payload for dev/staging smoke tests only. */
const SAMPLE_FIXTURE_PAYLOAD = {
  data: {
    items: [
      {
        postingId: "sample-1",
        url: "https://vancouver.craigslist.org/van/apa/d/sample-1.html",
        title: "Bright 2BR 2BA condo 850 sqft",
        price: 2650,
        bedrooms: 2,
        bathrooms: 2,
        sqft: 850,
        neighbourhood: "Sample Area",
      },
      {
        postingId: "sample-2",
        url: "https://vancouver.craigslist.org/van/apa/d/sample-2.html",
        title: "Modern 2BR 2BA condo 840 sqft",
        price: 2700,
        bedrooms: 2,
        bathrooms: 2,
        sqft: 840,
        neighbourhood: "Sample Area",
      },
      {
        postingId: "sample-3",
        url: "https://vancouver.craigslist.org/van/apa/d/sample-3.html",
        title: "Spacious 2BR 2BA unfurnished condo 860 sqft",
        price: 2750,
        bedrooms: 2,
        bathrooms: 2,
        sqft: 860,
        neighbourhood: "Sample Area",
      },
      {
        postingId: "sample-4",
        url: "https://vancouver.craigslist.org/van/apa/d/sample-4.html",
        title: "3BR condo near transit",
        price: 3100,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 900,
        neighbourhood: "Sample Area",
      },
    ],
  },
};

export function loadMarketRentSampleFixtureListings(city: string): RawScraperListing[] {
  return mapCraigslistSearchPayload(SAMPLE_FIXTURE_PAYLOAD, city);
}
