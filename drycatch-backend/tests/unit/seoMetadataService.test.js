import { describe, it, expect } from "vitest";
import { resolveListingPageSEO } from "../../src/services/seo/seoMetadataService.js";

// Regression coverage for rule #29-31 — faceted navigation / pagination
// must not each become a competing indexable "page."
describe("resolveListingPageSEO", () => {
  it("should index page 1 with no filters or sort", () => {
    const result = resolveListingPageSEO("/category/almonds", { page: 1 });
    expect(result.robots).toBe("index,follow");
    expect(result.canonical).toBe("/category/almonds");
  });

  it("should noindex page 2+ of the same listing", () => {
    const result = resolveListingPageSEO("/category/almonds", { page: 2 });
    expect(result.robots).toBe("noindex,follow");
    // still points crawl equity back at the canonical page 1, not itself
    expect(result.canonical).toBe("/category/almonds");
  });

  it("should noindex a filtered view even on page 1", () => {
    const result = resolveListingPageSEO("/category/almonds", { page: 1, hasFilters: true });
    expect(result.robots).toBe("noindex,follow");
  });

  it("should noindex a custom-sorted view even on page 1", () => {
    const result = resolveListingPageSEO("/category/almonds", { page: 1, hasSort: true });
    expect(result.robots).toBe("noindex,follow");
  });

  it("should always canonicalize to the clean base URL regardless of query params", () => {
    const result = resolveListingPageSEO("/category/almonds", { page: 7, hasFilters: true, hasSort: true });
    expect(result.canonical).toBe("/category/almonds");
  });
});
