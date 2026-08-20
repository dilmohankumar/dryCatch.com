import mongoose from "mongoose";

const seoSchema = new mongoose.Schema(
  {
    title: String, description: String, canonicalUrl: String,
    ogTitle: String, ogDescription: String, ogImage: String,
    robots: { type: String, enum: ["index_follow", "noindex_follow", "index_nofollow", "noindex_nofollow"], default: "index_follow" },
  },
  { _id: false }
);

// Separate from Page — a blog post has fields (excerpt, category, tags,
// featuredImage) a static/landing page doesn't need, and blog-specific
// listing/filtering (by category, by tag) is a genuinely different query
// shape than the page tree. Shares the same lifecycle enum and the same
// ContentRevision model (contentType: "blog") rather than a duplicate
// BlogRevision collection.
const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: String,
    content: { type: mongoose.Schema.Types.Mixed, default: [] }, // structured rich-text blocks (rule #33), sanitized on save
    featuredImage: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" },
    category: String,
    tags: [String],
    seo: seoSchema,

    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "scheduled", "published", "archived"],
      default: "draft",
    },
    version: { type: Number, default: 1 },

    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    publishedAt: Date,
    scheduledAt: Date,
  },
  { timestamps: true }
);

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ category: 1, status: 1 });
blogPostSchema.index({ tags: 1 });
blogPostSchema.index({ scheduledAt: 1 });

export default mongoose.model("BlogPost", blogPostSchema);
