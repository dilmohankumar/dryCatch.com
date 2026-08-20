import { describe, it, expect } from "vitest";
import {
  checkDateEligibility,
  checkMinimumSubtotal,
  checkMinimumQuantity,
  checkCustomerEligibility,
  checkFirstOrder,
} from "../../src/services/promotions/ruleEvaluator.js";

describe("promotions/ruleEvaluator", () => {
  describe("checkDateEligibility", () => {
    it("should reject a coupon that hasn't started yet", () => {
      const result = checkDateEligibility(new Date(Date.now() + 86_400_000), null);
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("COUPON_NOT_ACTIVE");
    });

    it("should reject an expired coupon", () => {
      const result = checkDateEligibility(null, new Date(Date.now() - 86_400_000));
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("COUPON_EXPIRED");
    });

    it("should accept a coupon currently within its active window", () => {
      const result = checkDateEligibility(new Date(Date.now() - 86_400_000), new Date(Date.now() + 86_400_000));
      expect(result.eligible).toBe(true);
    });
  });

  describe("checkMinimumSubtotal", () => {
    it("should reject an order below the minimum subtotal", () => {
      const result = checkMinimumSubtotal({ conditions: { minSubtotal: 500 } }, 400);
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("COUPON_MINIMUM_ORDER_NOT_MET");
    });

    it("should accept an order at or above the minimum subtotal", () => {
      expect(checkMinimumSubtotal({ conditions: { minSubtotal: 500 } }, 500).eligible).toBe(true);
      expect(checkMinimumSubtotal({ conditions: { minSubtotal: 500 } }, 600).eligible).toBe(true);
    });

    it("should accept any order when no minimum is configured", () => {
      expect(checkMinimumSubtotal({ conditions: {} }, 0).eligible).toBe(true);
    });
  });

  describe("checkMinimumQuantity", () => {
    it("should reject when cart quantity is below the configured minimum", () => {
      const result = checkMinimumQuantity({ conditions: { minQuantity: 3 } }, [{ quantity: 2 }]);
      expect(result.eligible).toBe(false);
    });

    it("should sum quantity across multiple line items, not just check one", () => {
      const result = checkMinimumQuantity({ conditions: { minQuantity: 3 } }, [{ quantity: 2 }, { quantity: 1 }]);
      expect(result.eligible).toBe(true);
    });
  });

  describe("checkCustomerEligibility", () => {
    it("should be open to all customers when no allowlist is configured", () => {
      expect(checkCustomerEligibility({ conditions: {} }, "any-customer-id").eligible).toBe(true);
    });

    it("should reject a customer not on the allowlist", () => {
      const result = checkCustomerEligibility({ conditions: { customerIds: ["abc"] } }, "xyz");
      expect(result.eligible).toBe(false);
    });

    it("should accept a customer on the allowlist", () => {
      const result = checkCustomerEligibility({ conditions: { customerIds: ["abc"] } }, "abc");
      expect(result.eligible).toBe(true);
    });
  });

  describe("checkFirstOrder", () => {
    it("should reject a returning customer when the coupon is first-order-only", () => {
      const result = checkFirstOrder({ conditions: { firstOrderOnly: true } }, false);
      expect(result.eligible).toBe(false);
    });

    it("should accept a first-time customer when the coupon is first-order-only", () => {
      expect(checkFirstOrder({ conditions: { firstOrderOnly: true } }, true).eligible).toBe(true);
    });
  });
});
