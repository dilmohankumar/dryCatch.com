import User from "../../src/models/User.js";
import Order from "../../src/models/Order.js";
import Payment from "../../src/models/Payment.js";
import Category from "../../src/models/Category.js";
import Product from "../../src/models/Product.js";
import ProductVariant from "../../src/models/ProductVariant.js";
import Promotion from "../../src/models/Promotion.js";
import Coupon from "../../src/models/Coupon.js";
import Role from "../../src/models/Role.js";
import * as inventoryService from "../../src/services/inventoryService.js";
import { DEFAULT_ROLES } from "../../src/utils/rbac.js";

// Test data factories (rule #9) — one function per entity, sensible
// defaults, override anything via the `overrides` param. Every id is
// randomized per call so tests never collide on unique fields (email,
// slug, sku, coupon code) even when run in the same process.
let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

export async function createUser(overrides = {}) {
  return User.create({
    firstName: "Test",
    lastName: "User",
    email: `${unique("user")}@example.com`,
    phone: `9${String(unique("")).slice(-9)}`,
    password: "ReasonablePassphrase1",
    isVerified: true,
    status: "active",
    ...overrides,
  });
}

export async function createAdmin(overrides = {}) {
  await seedTestRoles();
  const role = await Role.findOne({ name: overrides.roleName || "SUPER_ADMIN" });
  return User.create({
    firstName: "Admin",
    lastName: "User",
    email: `${unique("admin")}@example.com`,
    phone: `9${String(unique("")).slice(-9)}`,
    password: "ReasonablePassphrase1",
    isVerified: true,
    status: "active",
    role: "admin",
    adminRole: role?._id,
    ...overrides,
  });
}

export async function seedTestRoles() {
  for (const roleDef of DEFAULT_ROLES) {
    await Role.findOneAndUpdate({ name: roleDef.name }, { $setOnInsert: roleDef }, { upsert: true });
  }
}

export async function createCategory(overrides = {}) {
  return Category.create({
    name: "Test Category",
    slug: unique("cat-"),
    status: "active",
    ...overrides,
  });
}

export async function createProduct(overrides = {}) {
  const category = overrides.category || (await createCategory())._id;
  return Product.create({
    name: "Test Product",
    slug: unique("prod-"),
    category,
    status: "active",
    visibility: "public",
    price: 100,
    ...overrides,
  });
}

export async function createVariant(product, overrides = {}) {
  const productId = product?._id || product;
  return ProductVariant.create({
    product: productId,
    sku: unique("SKU-").toUpperCase(),
    price: 100,
    mrp: 120,
    status: "active",
    isDefault: true,
    combinationKey: unique("combo-"),
    ...overrides,
  });
}

// Stocks a variant with real quantity via the actual inventory service
// (not a hand-crafted Inventory doc) so tests exercise the same code path
// production traffic does.
export async function stockVariant(variantId, quantity = 100) {
  return inventoryService.receiveStock({ variantId, quantity, reason: "test stock", userId: null });
}

export async function createPromotion(overrides = {}) {
  return Promotion.create({
    name: "Test Promotion",
    type: "PERCENTAGE",
    value: 10,
    status: "active",
    startAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

export async function createOrder(user, overrides = {}) {
  const userId = user?._id || user;
  return Order.create({
    orderNumber: unique("ORD-"),
    user: userId,
    items: [],
    currency: "INR",
    subtotal: 1000,
    totalAmount: 1000,
    shippingAddress: { line1: "1 Test St", city: "Test City", state: "TS", pincode: "000000" },
    billingAddress: { line1: "1 Test St", city: "Test City", state: "TS", pincode: "000000" },
    status: "confirmed",
    ...overrides,
  });
}

export async function createPayment(order, user, overrides = {}) {
  return Payment.create({
    order: order._id || order,
    user: user._id || user,
    provider: "razorpay",
    providerOrderId: unique("rzp_order_"),
    amount: order.totalAmount ? order.totalAmount * 100 : 100000,
    currency: "INR",
    status: "created",
    ...overrides,
  });
}

export async function createCoupon(overrides = {}) {
  const promotion = overrides.promotion || (await createPromotion())._id;
  return Coupon.create({
    code: unique("COUPON").toUpperCase(),
    promotion,
    status: "active",
    ...overrides,
  });
}
