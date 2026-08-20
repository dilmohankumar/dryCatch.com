import Promotion from "../models/Promotion.js";
import Coupon from "../models/Coupon.js";
import { logAuditEvent } from "../utils/auditLog.js";

// All admin-only. Marketing/Support-specific RBAC (rule #79) isn't
// implemented — this project's roles are still just customer/admin (same
// honest limitation noted since Phase 9) — everything here sits behind the
// existing adminOnly middleware.

const PROMOTION_FIELDS = [
  "name", "description", "type", "status", "priority", "startAt", "endAt",
  "conditions", "actions", "requiresCoupon", "usageLimit", "perCustomerLimit", "stackable", "exclusive",
];

function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

export async function createPromotion(req, res) {
  const promotion = await Promotion.create({ ...pick(req.body, PROMOTION_FIELDS), createdBy: req.user._id });
  logAuditEvent("PROMOTION_CREATED", req.user._id, { promotionId: String(promotion._id) });
  res.status(201).json({ promotion });
}

export async function listPromotions(req, res) {
  const { status, type, search, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (search) filter.name = { $regex: search.trim(), $options: "i" };
  const [promotions, total] = await Promise.all([
    Promotion.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Promotion.countDocuments(filter),
  ]);
  res.json({ promotions, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) });
}

export async function getPromotion(req, res) {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) return res.status(404).json({ message: "Promotion not found" });
  res.json({ promotion });
}

export async function updatePromotion(req, res) {
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, pick(req.body, PROMOTION_FIELDS), { new: true, runValidators: true });
  if (!promotion) return res.status(404).json({ message: "Promotion not found" });
  logAuditEvent("PROMOTION_UPDATED", req.user._id, { promotionId: String(promotion._id) });
  res.json({ promotion });
}

async function setStatus(req, res, status) {
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!promotion) return res.status(404).json({ message: "Promotion not found" });
  logAuditEvent(`PROMOTION_${status.toUpperCase()}`, req.user._id, { promotionId: String(promotion._id) });
  res.json({ promotion });
}
export const activatePromotion = (req, res) => setStatus(req, res, "active");
export const pausePromotion = (req, res) => setStatus(req, res, "paused");
export const archivePromotion = (req, res) => setStatus(req, res, "archived");

// ---- Coupons ----

export async function createCoupon(req, res) {
  const { code, promotion, usageLimit, perCustomerLimit, startAt, endAt } = req.body;
  const coupon = await Coupon.create({
    code, promotion, usageLimit, perCustomerLimit, startAt, endAt, createdBy: req.user._id,
  });
  logAuditEvent("COUPON_CREATED", req.user._id, { couponId: String(coupon._id), code: coupon.code });
  res.status(201).json({ coupon });
}

export async function listCoupons(req, res) {
  const { status, search, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.code = { $regex: search.trim(), $options: "i" };
  const [coupons, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("promotion", "name type"),
    Coupon.countDocuments(filter),
  ]);
  res.json({ coupons, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) });
}

async function setCouponStatus(req, res, status) {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });
  logAuditEvent(`COUPON_${status.toUpperCase()}`, req.user._id, { couponId: String(coupon._id) });
  res.json({ coupon });
}
export const activateCoupon = (req, res) => setCouponStatus(req, res, "active");
export const pauseCoupon = (req, res) => setCouponStatus(req, res, "paused");
