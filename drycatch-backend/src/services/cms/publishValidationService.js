import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Collection from "../../models/Collection.js";
import MediaAsset from "../../models/MediaAsset.js";
import Banner from "../../models/Banner.js";
import FAQ from "../../models/FAQ.js";

// Before-publish checks (rule #67/#107) — never lets a page go live with a
// dangling reference (a deleted product in a ProductGrid block, an
// archived category, missing media). Returns a list of issues rather than
// throwing on the first one, so an editor sees everything wrong at once.
export async function validatePageForPublish(page) {
  const issues = [];

  if (!page.title) issues.push({ code: "MISSING_TITLE", message: "Page title is required" });
  if (!page.slug) issues.push({ code: "MISSING_SLUG", message: "Page slug is required" });
  if (!page.blocks?.length) issues.push({ code: "NO_CONTENT", message: "Page has no content blocks" });

  for (const block of page.blocks || []) {
    await checkBlockReferences(block, issues);
  }

  return issues;
}

async function checkBlockReferences(block, issues) {
  const { type, data } = block;

  if (type === "productGrid" && data.mode === "manual" && data.productIds?.length) {
    const found = await Product.countDocuments({ _id: { $in: data.productIds }, status: "active" });
    if (found < data.productIds.length) issues.push({ code: "BROKEN_PRODUCT_REFERENCE", message: "One or more products in a Product Grid block no longer exist or are inactive" });
  }
  if (type === "productGrid" && data.categoryId) {
    const exists = await Category.exists({ _id: data.categoryId, status: "active" });
    if (!exists) issues.push({ code: "BROKEN_CATEGORY_REFERENCE", message: "Product Grid block references a missing/archived category" });
  }
  if (type === "productGrid" && data.collectionId) {
    const exists = await Collection.exists({ _id: data.collectionId, status: "active" });
    if (!exists) issues.push({ code: "BROKEN_COLLECTION_REFERENCE", message: "Product Grid block references a missing/archived collection" });
  }
  if (type === "categoryGrid" && data.categoryIds?.length) {
    const found = await Category.countDocuments({ _id: { $in: data.categoryIds }, status: "active" });
    if (found < data.categoryIds.length) issues.push({ code: "BROKEN_CATEGORY_REFERENCE", message: "One or more categories in a Category Grid block no longer exist or are archived" });
  }
  if (type === "collectionGrid" && data.collectionIds?.length) {
    const found = await Collection.countDocuments({ _id: { $in: data.collectionIds }, status: "active" });
    if (found < data.collectionIds.length) issues.push({ code: "BROKEN_COLLECTION_REFERENCE", message: "One or more collections in a Collection Grid block no longer exist or are archived" });
  }
  if (type === "banner" && data.bannerId) {
    const exists = await Banner.exists({ _id: data.bannerId });
    if (!exists) issues.push({ code: "BROKEN_BANNER_REFERENCE", message: "Banner block references a missing banner" });
  }
  if (type === "faq" && data.faqIds?.length) {
    const found = await FAQ.countDocuments({ _id: { $in: data.faqIds }, status: "active" });
    if (found < data.faqIds.length) issues.push({ code: "BROKEN_FAQ_REFERENCE", message: "FAQ block references missing/inactive FAQs" });
  }
  if (type === "reviewSummary" && data.productId) {
    const exists = await Product.exists({ _id: data.productId, status: "active" });
    if (!exists) issues.push({ code: "BROKEN_PRODUCT_REFERENCE", message: "Review Summary block references a missing/inactive product" });
  }
  if ((type === "hero" || type === "image" || type === "imageText") && data.image) {
    const exists = await MediaAsset.exists({ _id: data.image, status: "ready" });
    if (!exists) issues.push({ code: "BROKEN_MEDIA_REFERENCE", message: `${type} block references missing/archived media` });
  }
}
