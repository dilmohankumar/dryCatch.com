import mongoose from "mongoose";

// A singleton (rule #56) — global SEO defaults a page/blog post falls
// back to when its own SEO fields are empty. Never the other way around:
// a page-specific value always wins over this default (seoService.js#
// resolveSEO). Mutating this requires an elevated permission
// (cms.seo.update, separate from ordinary page editing — rule #58/#126)
// so a content editor can't accidentally set the WHOLE SITE to noindex
// while editing one page.
const seoSettingsSchema = new mongoose.Schema(
  {
    defaultTitle: String,
    defaultDescription: String,
    defaultOgImage: String,
    robotsGlobal: { type: String, enum: ["index_follow", "noindex_follow"], default: "index_follow" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("SEOSettings", seoSettingsSchema);
