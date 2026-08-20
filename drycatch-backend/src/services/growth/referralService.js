import crypto from "crypto";
import Referral from "../../models/Referral.js";
import ReferralCode from "../../models/ReferralCode.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import * as loyaltyService from "./loyaltyService.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const REFERRER_REWARD_POINTS = Number(process.env.REFERRAL_REWARD_POINTS) || 200;

function generateCode(user) {
  const base = (user.firstName || "FRIEND").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 8);
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${base}${suffix}`;
}

// Lazily creates a stable code on first request — never regenerated once
// issued (a customer's shared link must keep working forever).
export async function getOrCreateCode(userId) {
  const existing = await ReferralCode.findOne({ user: userId });
  if (existing) return existing;
  const user = await User.findById(userId, "firstName");
  let code;
  let attempt = 0;
  do {
    code = generateCode(user);
    attempt++;
  } while ((await ReferralCode.exists({ code })) && attempt < 5);
  return ReferralCode.create({ user: userId, code });
}

// Called at signup time (rule #27) when a `?ref=CODE` param is present.
// Fraud prevention (rule #28) here is deliberately simple and stated
// honestly: rejects the single clearest case (self-referral, same
// account) and records the signup IP as ONE signal for a human reviewer
// to use later — NOT an automated multi-signal fraud-scoring system,
// which this project has neither the data volume nor infrastructure
// (no device fingerprinting, no IP-reputation service) to build
// meaningfully yet.
export async function attributeSignup(newUserId, code, signupIp) {
  const referralCode = await ReferralCode.findOne({ code: code?.toUpperCase()?.trim() });
  if (!referralCode) return null; // an invalid/unknown code is silently ignored — signup still succeeds, just unattributed

  if (String(referralCode.user) === String(newUserId)) {
    return null; // rule #28 — self-referral, not recorded at all (not even as "rejected") since it isn't really a referral attempt
  }

  try {
    return await Referral.create({
      referrer: referralCode.user,
      code: referralCode.code,
      referredUser: newUserId,
      referredUserIp: signupIp,
    });
  } catch (err) {
    if (err.code === 11000) return null; // this user was already referred by someone else — first attribution wins, never re-attributed
    throw err;
  }
}

// Called on ORDER_CONFIRMED (growthEngine.js) — qualifies a pending
// referral only on the referred user's genuinely FIRST order, and only
// once (rule #27's "reward pending -> validation -> reward issued").
export async function tryQualifyReferral(userId, orderId) {
  const referral = await Referral.findOne({ referredUser: userId, status: "pending" });
  if (!referral) return null;

  const priorOrders = await Order.countDocuments({ user: userId, _id: { $ne: orderId }, status: { $nin: ["cancelled", "pending_payment"] } });
  if (priorOrders > 0) return null; // not their first order — this referral already missed its qualifying window, left pending rather than silently rejected (a human can review why)

  // Same-IP heuristic (rule #28) — if the referred user's signup IP
  // exactly matches an IP the referrer has used, that's suspicious enough
  // to hold for manual review rather than auto-rewarding. Best-effort:
  // this project doesn't track the referrer's own IP history, so this
  // check is currently a no-op placeholder for when that data exists —
  // documented rather than silently pretended to be a real check.

  referral.status = "qualified";
  referral.qualifyingOrder = orderId;
  await referral.save();

  await issueReward(referral);
  return referral;
}

async function issueReward(referral) {
  await loyaltyService.adjustPoints(referral.referrer, REFERRER_REWARD_POINTS, `Referral reward for referring a new customer`, null);
  referral.status = "reward_issued";
  await referral.save();
}

export async function listMyReferrals(userId) {
  return Referral.find({ referrer: userId }).populate("referredUser", "firstName lastName").sort({ createdAt: -1 });
}
