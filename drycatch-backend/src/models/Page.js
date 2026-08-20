import mongoose from "mongoose";

// A single model for static pages, marketing landing pages, AND the
// homepage — rule #4 lists these as separate CMS modules, but they're the
// same underlying entity (title, slug, blocks, SEO, lifecycle) with
// different `pageType` values, not three separate schemas that would
// otherwise duplicate the entire lifecycle/revision/block machinery three
// times. The homepage is simply the one Page with `pageType: "homepage"`
// (singleton, enforced in pageService.js, not by a unique index on
// pageType since a future multi-store CMS would need more than one).
//
// Blocks are embedded, structured JSON (rule #14/#16) — never a raw HTML
// blob as the primary representation. Each block references commerce
// entities by id (productIds/categoryId/collectionId) — CMS never
// snapshots price/stock/name into a block (rule #20/#139/#140).
const blockSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // see services/cms/blockRegistry.js for the full type catalog
    order: { type: Number, default: 0 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    visibility: { type: String, enum: ["visible", "hidden"], default: "visible" },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} }, // spacing/alignment/background — design tokens, never arbitrary CSS (rule #103)
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    canonicalUrl: String,
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    robots: { type: String, enum: ["index_follow", "noindex_follow", "index_nofollow", "noindex_nofollow"], default: "index_follow" },
  },
  { _id: false }
);

const pageSchema = new mongoose.Schema(
  {
    pageType: { type: String, enum: ["static", "landing", "homepage"], default: "static" },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    blocks: [blockSchema],
    seo: seoSchema,

    // Explicit lifecycle (rule #9/#166) — see utils/contentStateMachine.js
    // for the transition graph. Never an arbitrary string field.
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "scheduled", "published", "archived"],
      default: "draft",
    },
    version: { type: Number, default: 1 }, // bumped on every save that creates a ContentRevision

    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    publishedAt: Date,
    scheduledAt: Date, // when a "scheduled" page should flip to "published"
    unpublishAt: Date, // optional — when a published page should auto-archive
  },
  { timestamps: true }
);

pageSchema.index({ status: 1, pageType: 1 });
pageSchema.index({ scheduledAt: 1 });
pageSchema.index({ unpublishAt: 1 });

export default mongoose.model("Page", pageSchema);
