import mongoose from "mongoose";

// Phase 24 — an IMMUTABLE, append-only ledger (rule #24 — "never store
// only a mutable point balance"). A customer's balance is always
// DERIVED by summing their entries, never stored and mutated directly —
// the same reasoning as this project's financial models (Payment/Refund)
// never overwriting a number in place. `referenceType`/`referenceId` ties
// an EARN back to the order/review/referral that caused it, so "why does
// this customer have 500 points" is always answerable from the ledger
// alone.
const loyaltyLedgerEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["EARN", "REDEEM", "EXPIRE", "ADJUST", "REFUND_REVERSAL"], required: true },
    points: { type: Number, required: true }, // positive for EARN/ADJUST(credit), negative for REDEEM/EXPIRE/ADJUST(debit)/REFUND_REVERSAL
    source: { type: String, required: true }, // "order" | "review" | "referral" | "admin_adjustment" | "expiration"
    referenceType: String, // "Order" | "Review" | "Referral" | undefined for manual admin adjustments
    referenceId: mongoose.Schema.Types.ObjectId,
    expiresAt: Date, // set on EARN entries; an expiration sweep creates a matching EXPIRE entry, never deletes the EARN
    idempotencyKey: { type: String, unique: true, sparse: true }, // rule #72 — "award loyalty points" must be idempotent under retry
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // set only for ADJUST (admin-initiated)
    note: String,
  },
  { timestamps: true }
);

loyaltyLedgerEntrySchema.index({ user: 1, createdAt: -1 });
loyaltyLedgerEntrySchema.index({ user: 1, type: 1, expiresAt: 1 });

export default mongoose.model("LoyaltyLedgerEntry", loyaltyLedgerEntrySchema);
