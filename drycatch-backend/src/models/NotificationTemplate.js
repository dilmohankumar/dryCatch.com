import mongoose from "mongoose";

// One template per (type, channel) — e.g. ORDER_SHIPPED/email vs
// ORDER_SHIPPED/sms are separate rows since subject/body shape differs
// per channel (rule #44: SMS stays short, never the full email body).
// `variables` is the declared contract used by templateService's
// validate-before-publish check (rule #142).
const notificationTemplateSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // eventType this template renders for, e.g. ORDER_SHIPPED
    channel: { type: String, enum: ["email", "sms", "push", "in_app", "web_push", "whatsapp"], required: true },
    name: { type: String, required: true },
    locale: { type: String, default: "en-IN" }, // localization readiness (rule #40) — not all locales populated yet
    subject: String, // email only
    body: { type: String, required: true }, // plain {{var}} placeholders, never raw executable code (rule #37)
    variables: [{ type: String }], // declared variable contract, e.g. ["customerName", "orderNumber"]
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    version: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

notificationTemplateSchema.index({ type: 1, channel: 1, locale: 1 }, { unique: true });

export default mongoose.model("NotificationTemplate", notificationTemplateSchema);
