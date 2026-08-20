import mongoose from "mongoose";

// A singleton document (rule #45) — one footer configuration for the
// store, not a list. `footerService.js` always reads/writes the single
// row (upserting on first write) rather than exposing CRUD over a
// collection that only ever has one meaningful document.
const footerConfigSchema = new mongoose.Schema(
  {
    columns: [
      {
        title: String,
        links: [{ label: String, url: String, refId: mongoose.Schema.Types.ObjectId, type: String }],
      },
    ],
    socialLinks: [{ platform: String, url: String }],
    contactInfo: { email: String, phone: String, address: String },
    legalLinks: [{ label: String, url: String }],
    newsletterHeading: String,
    newsletterSubtext: String,
  },
  { timestamps: true }
);

export default mongoose.model("FooterConfig", footerConfigSchema);
