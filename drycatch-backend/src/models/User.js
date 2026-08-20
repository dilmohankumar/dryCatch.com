import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    // Phase 14 — the granular RBAC role, only meaningful when role ===
    // "admin". Absent entirely for customers. See utils/rbac.js for why
    // this sits alongside, not instead of, the coarse role field above.
    adminRole: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    // "deactivated" is reversible and customer-initiated (self-service);
    // "blocked" (Phase 14) is the admin-initiated equivalent for customer
    // accounts — kept as a distinct value so an audit log entry / support
    // conversation is never ambiguous about who took the account offline.
    status: { type: String, enum: ["active", "deactivated", "blocked"], default: "active" },
    blockedAt: Date,
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    blockReason: String,

    isVerified: { type: Boolean, default: false },
    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    // Phase 24 — carries a referral code from signup through to OTP
    // verification (two separate requests); cleared once attributed so it
    // never lingers or gets re-used.
    pendingReferralCode: { type: String, select: false },

    // Bumped on logout / password reset so previously-issued refresh tokens
    // (which embed the version they were signed with) stop being accepted —
    // gives real refresh-token revocation despite JWTs being stateless.
    tokenVersion: { type: Number, default: 0, select: false },

    // Addresses moved to their own collection (models/Address.js) so an
    // Order can later snapshot a purchase-time copy of the fields without
    // depending on a mutable/deletable subdocument here. Cart moved to its
    // own Cart/CartItem collections (Phase 6) — see models/Cart.js — so
    // guest (non-account) carts can exist without a User document at all.
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpires;
  delete obj.tokenVersion;
  return obj;
};

export default mongoose.model("User", userSchema);
