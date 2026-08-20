import { describe, it, expect } from "vitest";
import * as metrics from "../../src/services/analytics/metricService.js";

// Phase 20 regression coverage for Phase 19/17's revenue-definition rule
// (rule #151 — "create order ₹1,000, discount ₹100, refund ₹200, verify
// the defined revenue metrics" — this is exactly that scenario).
describe("analytics/metricService", () => {
  it("should calculate netSales as gross minus discount minus refund per the centrally-defined formula", () => {
    const row = { grossSales: 1000, discountAmount: 100, refundAmount: 200 };
    expect(metrics.netSales(row)).toBe(700);
  });

  it("should exclude cancelled orders from the AOV denominator", () => {
    const row = { grossSales: 1000, discountAmount: 0, refundAmount: 0, ordersCount: 2, cancelledCount: 1 };
    expect(metrics.averageOrderValue(row)).toBe(1000); // 1 eligible order, not 2
  });

  it("should return 0 AOV rather than dividing by zero when all orders are cancelled", () => {
    const row = { grossSales: 1000, ordersCount: 1, cancelledCount: 1 };
    expect(metrics.averageOrderValue(row)).toBe(0);
  });

  it("should calculate conversionRate as completed orders over visitors", () => {
    expect(metrics.conversionRate({ visitors: 200, orderCompleted: 10 })).toBe(0.05);
  });

  it("should return 0 conversionRate rather than NaN when there are no visitors", () => {
    expect(metrics.conversionRate({ visitors: 0, orderCompleted: 0 })).toBe(0);
  });

  it("should calculate historicalCLV as total revenue over distinct customers", () => {
    expect(metrics.historicalCLV(10000, 25)).toBe(400);
  });

  it("should interpolate percentile correctly for delivery-time P50/P90", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(metrics.percentile(sorted, 50)).toBeCloseTo(5.5, 1);
    expect(metrics.percentile(sorted, 100)).toBe(10);
    expect(metrics.percentile(sorted, 0)).toBe(1);
  });

  it("should return 0 percentile for an empty sample set rather than throwing", () => {
    expect(metrics.percentile([], 90)).toBe(0);
  });
});
