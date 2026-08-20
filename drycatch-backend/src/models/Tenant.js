import mongoose from "mongoose";

// Phase 25 — the root of multi-tenancy. Every tenant-owned document across
// the platform points back here via `tenantId`. Settings are grouped into
// named sub-schemas (rule #24) rather than one uncontrolled JSON blob, so
// each category can be validated and extended independently.
const brandingSchema = new mongoose.Schema(
  {
    storeName: String,
    logoUrl: String,
    faviconUrl: String,
    primaryColor: String,
    accentColor: String,
    emailFromName: String,
    emailLogoUrl: String,
    socialImageUrl: String,
  },
  { _id: false }
);

const commerceSchema = new mongoose.Schema(
  {
    currency: { type: String, default: "INR" },
    defaultLocale: { type: String, default: "en-IN" },
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    defaultTitle: String,
    defaultDescription: String,
    robotsIndexable: { type: Boolean, default: true },
  },
  { _id: false }
);

const growthSchema = new mongoose.Schema(
  {
    loyaltyEnabled: { type: Boolean, default: true },
    referralsEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    branding: { type: brandingSchema, default: () => ({}) },
    commerce: { type: commerceSchema, default: () => ({}) },
    seo: { type: seoSchema, default: () => ({}) },
    growth: { type: growthSchema, default: () => ({}) },
  },
  { _id: false }
);

const onboardingSchema = new mongoose.Schema(
  {
    accountCreated: { type: Boolean, default: true },
    storeCreated: { type: Boolean, default: true },
    domainConfigured: { type: Boolean, default: false },
    paymentConfigured: { type: Boolean, default: false },
    shippingConfigured: { type: Boolean, default: false },
    firstProductCreated: { type: Boolean, default: false },
    storePublished: { type: Boolean, default: false },
  },
  { _id: false }
);

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // The platform-subdomain identity (store-a.platform.com) — always
    // present, even after a custom domain is added, so the store never
    // loses a working URL if the custom domain's DNS breaks.
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Lifecycle, not a boolean — "suspended" and "cancelled" behave very
    // differently (rule #56/#57) and neither is a hard delete.
    status: {
      type: String,
      enum: ["active", "trialing", "suspended", "past_due", "cancelled", "deletion_requested", "deleted"],
      default: "trialing",
    },
    plan: { type: String, enum: ["free", "starter", "growth", "business", "enterprise"], default: "free" },
    timezone: { type: String, default: "Asia/Kolkata" },
    settings: { type: settingsSchema, default: () => ({}) },
    onboarding: { type: onboardingSchema, default: () => ({}) },
    suspendedAt: Date,
    suspendedReason: String,
    deletionRequestedAt: Date,
    // Retention window before a deletion_requested tenant becomes eligible
    // for permanent removal (rule #57) — never immediate.
    deletionEligibleAt: Date,
  },
  { timestamps: true }
);

tenantSchema.index({ status: 1 });

export default mongoose.model("Tenant", tenantSchema);
