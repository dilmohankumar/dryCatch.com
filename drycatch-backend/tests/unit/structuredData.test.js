import { describe, it, expect } from "vitest";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildFaqJsonLd,
} from "../../src/services/seo/structuredData.js";

describe("structuredData", () => {
  it("should build valid Organization JSON-LD", () => {
    const data = buildOrganizationJsonLd();
    expect(data["@type"]).toBe("Organization");
    expect(data.name).toBeTruthy();
    expect(data.url).toMatch(/^https?:\/\//);
  });

  it("should build valid WebSite JSON-LD without a fabricated SearchAction", () => {
    const data = buildWebsiteJsonLd();
    expect(data["@type"]).toBe("WebSite");
    expect(data.potentialAction).toBeUndefined();
  });

  it("should build a BreadcrumbList with correct positions", () => {
    const data = buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Snacks", path: "/category/snacks" },
      { name: "Almonds", path: "/products/almonds" },
    ]);
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement).toHaveLength(3);
    expect(data.itemListElement[0].position).toBe(1);
    expect(data.itemListElement[2].position).toBe(3);
    expect(data.itemListElement[2].item).toContain("/products/almonds");
  });

  it("should build Product JSON-LD with InStock availability when a variant has stock", () => {
    const product = { name: "Almonds", slug: "almonds", price: 500, media: [{ url: "http://x/img.jpg" }], reviewsCount: 0, rating: 0 };
    const data = buildProductJsonLd(product, { variant: { sku: "ALM-500", price: 550, availableQuantity: 10 } });
    expect(data["@type"]).toBe("Product");
    expect(data.offers.availability).toBe("https://schema.org/InStock");
    expect(data.offers.price).toBe("550");
    expect(data.sku).toBe("ALM-500");
  });

  it("should build Product JSON-LD with OutOfStock availability when a variant has none", () => {
    const product = { name: "Almonds", slug: "almonds", price: 500, media: [] };
    const data = buildProductJsonLd(product, { variant: { sku: "ALM-500", availableQuantity: 0, available: false } });
    expect(data.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("should NOT include aggregateRating when the product has no published reviews (never fabricate)", () => {
    const product = { name: "Almonds", slug: "almonds", price: 500, media: [], reviewsCount: 0, rating: 0 };
    const data = buildProductJsonLd(product, {});
    expect(data.aggregateRating).toBeUndefined();
  });

  it("should include aggregateRating only when real review data exists", () => {
    const product = { name: "Almonds", slug: "almonds", price: 500, media: [], reviewsCount: 12, rating: 4.5 };
    const data = buildProductJsonLd(product, {});
    expect(data.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: "4.5", reviewCount: "12" });
  });

  it("should return null for FAQ JSON-LD when there are no FAQs, rather than an empty fabricated block", () => {
    expect(buildFaqJsonLd([])).toBeNull();
    expect(buildFaqJsonLd(undefined)).toBeNull();
  });

  it("should build valid FAQPage JSON-LD from real FAQ content", () => {
    const data = buildFaqJsonLd([{ question: "Is this vegan?", answer: "Yes." }]);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity[0].name).toBe("Is this vegan?");
  });
});
