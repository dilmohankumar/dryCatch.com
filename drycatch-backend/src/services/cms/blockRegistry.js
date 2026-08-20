// The centralized block type catalog (rule #18/#19) — every block's shape
// is validated here before a page can save/publish. Adding a new block
// type means adding one entry to this map, never a new giant conditional
// scattered through pageService/BlockRenderer.
function fail(message) {
  throw Object.assign(new Error(message), { statusCode: 400, code: "INVALID_BLOCK" });
}

function requireFields(data, fields, blockType) {
  const missing = fields.filter((f) => data[f] === undefined || data[f] === null || data[f] === "");
  if (missing.length) fail(`${blockType} block is missing required field(s): ${missing.join(", ")}`);
}

// Every validator both checks required fields AND strips unknown ones
// (rule #17: "do not accept unknown fields silently") — returns the
// sanitized data object pageService actually persists.
export const BLOCK_TYPES = {
  hero: {
    requiredFields: ["title", "image"],
    allowedFields: ["title", "subtitle", "image", "mobileImage", "cta", "ctaUrl"],
  },
  richText: {
    requiredFields: ["content"],
    allowedFields: ["content"], // structured rich-text JSON, sanitized separately via utils/sanitizeText.js before save
  },
  image: {
    requiredFields: ["image"],
    allowedFields: ["image", "altText", "link"],
  },
  imageText: {
    requiredFields: ["image", "content"],
    allowedFields: ["image", "content", "heading", "ctaUrl", "reverse"],
  },
  productGrid: {
    requiredFields: [],
    allowedFields: ["heading", "mode", "productIds", "categoryId", "collectionId", "limit"], // mode: "manual"|"category"|"collection"|"bestSellers"|"newArrivals"|"featured" — rule #21
  },
  categoryGrid: {
    requiredFields: ["categoryIds"],
    allowedFields: ["heading", "categoryIds"],
  },
  collectionGrid: {
    requiredFields: ["collectionIds"],
    allowedFields: ["heading", "collectionIds"],
  },
  banner: {
    requiredFields: ["bannerId"],
    allowedFields: ["bannerId"], // references a real Banner document — never a second copy of banner content
  },
  faq: {
    requiredFields: [],
    allowedFields: ["heading", "category", "faqIds"], // empty faqIds = show all active FAQs in `category`
  },
  testimonials: {
    requiredFields: [],
    allowedFields: ["heading", "reviewIds"], // references real Reviews (Phase 12) — never duplicated review text
  },
  newsletter: {
    requiredFields: [],
    allowedFields: ["heading", "subtext"],
  },
  cta: {
    requiredFields: ["label", "url"],
    allowedFields: ["heading", "label", "url", "style"],
  },
  blogGrid: {
    requiredFields: [],
    allowedFields: ["heading", "category", "limit"],
  },
  reviewSummary: {
    requiredFields: ["productId"],
    allowedFields: ["productId"], // references Phase 12's Product.rating aggregate — never recalculated here
  },
  spacer: {
    requiredFields: [],
    allowedFields: ["height"],
  },
};

export function validateBlock(block) {
  const def = BLOCK_TYPES[block.type];
  if (!def) fail(`Unknown block type: ${block.type}`);
  requireFields(block.data || {}, def.requiredFields, block.type);

  const sanitizedData = {};
  for (const field of def.allowedFields) {
    if (block.data?.[field] !== undefined) sanitizedData[field] = block.data[field];
  }
  return { ...block, data: sanitizedData };
}

export function validateBlocks(blocks = []) {
  return blocks.map((b, i) => ({ ...validateBlock(b), order: b.order ?? i }));
}
