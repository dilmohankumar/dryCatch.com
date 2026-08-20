import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDb, stopTestDb, clearTestDb } from "../helpers/testDb.js";
import { createUser, createOrder } from "../helpers/factories.js";
import * as loyaltyService from "../../src/services/growth/loyaltyService.js";
import * as referralService from "../../src/services/growth/referralService.js";
import * as featureFlagService from "../../src/services/growth/featureFlagService.js";
import FeatureFlag from "../../src/models/FeatureFlag.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe("loyaltyService — immutable ledger (Phase 24 rule #24/#72)", () => {
  it("should earn points proportional to order value", async () => {
    const user = await createUser();
    const order = await createOrder(user, { totalAmount: 1000 });
    await loyaltyService.earnFromOrder(order);
    expect(await loyaltyService.getBalance(user._id)).toBe(1000);
  });

  it("should be idempotent — earning twice for the same order does not double-award", async () => {
    const user = await createUser();
    const order = await createOrder(user, { totalAmount: 500 });
    await loyaltyService.earnFromOrder(order);
    await loyaltyService.earnFromOrder(order); // simulates a retried ORDER_DELIVERED event
    expect(await loyaltyService.getBalance(user._id)).toBe(500);
  });

  it("should reject redemption exceeding the current balance", async () => {
    const user = await createUser();
    const order = await createOrder(user, { totalAmount: 100 });
    await loyaltyService.earnFromOrder(order);
    await expect(loyaltyService.redeemPoints(user._id, 1000)).rejects.toThrow();
  });

  it("should allow redemption within balance and derive the balance from the ledger sum, not a stored field", async () => {
    const user = await createUser();
    const order = await createOrder(user, { totalAmount: 1000 });
    await loyaltyService.earnFromOrder(order);
    await loyaltyService.redeemPoints(user._id, 400);
    expect(await loyaltyService.getBalance(user._id)).toBe(600);
  });

  it("should reverse points proportionally on a partial refund", async () => {
    const user = await createUser();
    const order = await createOrder(user, { totalAmount: 1000 });
    await loyaltyService.earnFromOrder(order);
    await loyaltyService.reverseForRefund(order, 500); // half refunded
    expect(await loyaltyService.getBalance(user._id)).toBe(500);
  });

  it("should never let an admin adjustment be zero (must be a real, non-zero, auditable entry)", async () => {
    const user = await createUser();
    await expect(loyaltyService.adjustPoints(user._id, 0, "test", null)).rejects.toThrow();
  });
});

describe("referralService — fraud prevention (rule #28)", () => {
  it("should reject self-referral (same account) entirely, not just mark it rejected", async () => {
    const user = await createUser();
    const code = await referralService.getOrCreateCode(user._id);
    const result = await referralService.attributeSignup(user._id, code.code, "1.2.3.4");
    expect(result).toBeNull();
  });

  it("should attribute a genuine referral from a different user", async () => {
    const referrer = await createUser();
    const newUser = await createUser();
    const code = await referralService.getOrCreateCode(referrer._id);
    const referral = await referralService.attributeSignup(newUser._id, code.code, "5.6.7.8");
    expect(referral).not.toBeNull();
    expect(referral.status).toBe("pending");
  });

  it("should ignore an unknown/invalid referral code without erroring", async () => {
    const newUser = await createUser();
    const result = await referralService.attributeSignup(newUser._id, "NOTAREALCODE", "1.1.1.1");
    expect(result).toBeNull();
  });

  it("should only ever attribute one referral per referred user (first attribution wins)", async () => {
    const referrerA = await createUser();
    const referrerB = await createUser();
    const newUser = await createUser();
    const codeA = await referralService.getOrCreateCode(referrerA._id);
    const codeB = await referralService.getOrCreateCode(referrerB._id);

    const first = await referralService.attributeSignup(newUser._id, codeA.code, "1.1.1.1");
    const second = await referralService.attributeSignup(newUser._id, codeB.code, "1.1.1.1");

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("should qualify a referral only on the referred user's genuinely first order", async () => {
    const referrer = await createUser();
    const newUser = await createUser();
    const code = await referralService.getOrCreateCode(referrer._id);
    await referralService.attributeSignup(newUser._id, code.code, "9.9.9.9");

    const order = await createOrder(newUser, { status: "confirmed" });
    const qualified = await referralService.tryQualifyReferral(newUser._id, order._id);

    expect(qualified.status).toBe("reward_issued");
    expect(await loyaltyService.getBalance(referrer._id)).toBeGreaterThan(0);
  });

  it("should NOT qualify (or double-reward) on a second order", async () => {
    const referrer = await createUser();
    const newUser = await createUser();
    const code = await referralService.getOrCreateCode(referrer._id);
    await referralService.attributeSignup(newUser._id, code.code, "9.9.9.9");

    const firstOrder = await createOrder(newUser, { status: "confirmed" });
    await referralService.tryQualifyReferral(newUser._id, firstOrder._id);
    const balanceAfterFirst = await loyaltyService.getBalance(referrer._id);

    const secondOrder = await createOrder(newUser, { status: "confirmed" });
    const secondResult = await referralService.tryQualifyReferral(newUser._id, secondOrder._id);

    expect(secondResult).toBeNull();
    expect(await loyaltyService.getBalance(referrer._id)).toBe(balanceAfterFirst);
  });
});

describe("featureFlagService — stable assignment (rule #50)", () => {
  it("should always return false for an undefined flag", async () => {
    expect(await featureFlagService.isEnabled("nonexistent_flag", "user123")).toBe(false);
  });

  it("should respect the kill switch (enabled:false) regardless of rolloutPercent", async () => {
    await FeatureFlag.create({ key: "killed_flag", description: "test", enabled: false, rolloutPercent: 100 });
    expect(await featureFlagService.isEnabled("killed_flag", "user123")).toBe(false);
  });

  it("should return true for every subject at 100% rollout", async () => {
    await FeatureFlag.create({ key: "full_rollout", description: "test", enabled: true, rolloutPercent: 100 });
    expect(await featureFlagService.isEnabled("full_rollout", "any-user-id-1")).toBe(true);
    expect(await featureFlagService.isEnabled("full_rollout", "any-user-id-2")).toBe(true);
  });

  it("should return false for every subject at 0% rollout", async () => {
    await FeatureFlag.create({ key: "zero_rollout", description: "test", enabled: true, rolloutPercent: 0 });
    expect(await featureFlagService.isEnabled("zero_rollout", "any-user-id")).toBe(false);
  });

  it("should give the SAME subject the SAME result on repeated checks (stable assignment)", async () => {
    await FeatureFlag.create({ key: "partial_rollout", description: "test", enabled: true, rolloutPercent: 50 });
    const first = await featureFlagService.isEnabled("partial_rollout", "stable-user-id");
    const second = await featureFlagService.isEnabled("partial_rollout", "stable-user-id");
    const third = await featureFlagService.isEnabled("partial_rollout", "stable-user-id");
    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});
