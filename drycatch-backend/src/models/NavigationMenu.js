import mongoose from "mongoose";

// Two levels only (top item + mega-menu children) — deliberately not a
// fully recursive arbitrary-depth tree (rule #44 allows "if required";
// this store's nav doesn't need more, and a flat 2-level shape is far
// simpler to render/edit than genuine recursion).
const menuItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: { type: String, enum: ["page", "product", "category", "collection", "external", "anchor"], default: "external" },
    // A reference where one exists (rule #43: "do not store internal URLs
    // blindly when an entity reference is more appropriate") — `url` is
    // only used for type "external"/"anchor".
    refId: mongoose.Schema.Types.ObjectId,
    url: String,
    target: { type: String, enum: ["_self", "_blank"], default: "_self" },
    order: { type: Number, default: 0 },
    visibility: { type: String, enum: ["visible", "hidden"], default: "visible" },
    children: [
      {
        label: String,
        type: { type: String, enum: ["page", "product", "category", "collection", "external", "anchor"], default: "external" },
        refId: mongoose.Schema.Types.ObjectId,
        url: String,
        order: { type: Number, default: 0 },
        visibility: { type: String, enum: ["visible", "hidden"], default: "visible" },
      },
    ],
  },
  { _id: false }
);

// One document per named menu ("header", "footer") — a singleton per
// name, not a per-tenant collection (multi-tenant CMS is an explicitly
// documented gap, same as Phase 14's admin RBAC).
const navigationMenuSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // "header" | "footer" | ...
    items: [menuItemSchema],
  },
  { timestamps: true }
);

export default mongoose.model("NavigationMenu", navigationMenuSchema);
