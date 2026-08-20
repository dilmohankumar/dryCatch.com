import mongoose from "mongoose";

// A dedicated collection (not an embedded array on User) so that:
//  - future Order records can snapshot the address fields at purchase time
//    without depending on a mutable, deletable subdocument
//  - "default shipping" and "default billing" can be tracked independently
//  - address ownership is enforced the same way any other owned resource is
//    (query by { _id, user: req.user._id }, never trust a client-supplied userId)
const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["shipping", "billing", "both"], default: "both" },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: "India", trim: true },
    isDefaultShipping: { type: Boolean, default: false },
    isDefaultBilling: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index({ user: 1 });
addressSchema.index({ user: 1, isDefaultShipping: 1 });
addressSchema.index({ user: 1, isDefaultBilling: 1 });

export default mongoose.model("Address", addressSchema);
