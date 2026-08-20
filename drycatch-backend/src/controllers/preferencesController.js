import UserPreferences from "../models/UserPreferences.js";
import { logAuditEvent } from "../utils/auditLog.js";

const ALLOWED_FIELDS = ["marketingEmail", "marketingSms", "productRecommendations", "backInStockAlerts"];

function pickAllowed(body) {
  const out = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) out[field] = !!body[field];
  }
  return out;
}

// GET /preferences — creates a default row on first access rather than
// requiring a separate "initialize preferences" step.
export async function getPreferences(req, res) {
  const prefs = await UserPreferences.findOneAndUpdate(
    { user: req.user._id },
    { $setOnInsert: { user: req.user._id } },
    { new: true, upsert: true }
  );
  res.json({ preferences: prefs });
}

// PATCH /preferences
export async function updatePreferences(req, res) {
  const data = pickAllowed(req.body);
  const prefs = await UserPreferences.findOneAndUpdate(
    { user: req.user._id },
    { $set: data, $setOnInsert: { user: req.user._id } },
    { new: true, upsert: true }
  );
  logAuditEvent("PREFERENCES_UPDATED", req.user._id, { fields: Object.keys(data) });
  res.json({ preferences: prefs });
}
