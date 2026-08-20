import crypto from "crypto";
import FeatureFlag from "../../models/FeatureFlag.js";

function fail(message, code, statusCode = 404) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Stable percentage rollout (rule #50 — "the same eligible customer
// should generally receive the same variant"), not a per-request random
// roll: hashes (flagKey + userId) so a given user always lands in the
// same bucket for a given flag, deterministically, without storing an
// assignment record.
function stableBucket(flagKey, subjectId) {
  const hash = crypto.createHash("sha256").update(`${flagKey}:${subjectId}`).digest("hex");
  const intVal = parseInt(hash.slice(0, 8), 16);
  return intVal % 100; // 0-99
}

export async function isEnabled(flagKey, subjectId) {
  const flag = await FeatureFlag.findOne({ key: flagKey });
  if (!flag) return false; // an undefined flag defaults OFF — never silently on
  if (!flag.enabled) return false; // the kill switch (rule #48) always wins
  if (flag.rolloutPercent >= 100) return true;
  if (flag.rolloutPercent <= 0) return false;
  if (!subjectId) return false; // no stable identity to bucket an anonymous request against — default OFF, not a random 50/50 per request
  return stableBucket(flagKey, subjectId) < flag.rolloutPercent;
}

export async function createFlag(data, actorId) {
  const existing = await FeatureFlag.findOne({ key: data.key });
  if (existing) fail("A flag with this key already exists", "FLAG_KEY_TAKEN", 409);
  return FeatureFlag.create({ ...data, createdBy: actorId, updatedBy: actorId });
}

export async function updateFlag(id, data, actorId) {
  const flag = await FeatureFlag.findById(id);
  if (!flag) fail("Flag not found", "FLAG_NOT_FOUND");
  Object.assign(flag, data, { updatedBy: actorId });
  await flag.save();
  return flag;
}

export async function listFlags() {
  return FeatureFlag.find().sort({ key: 1 });
}
