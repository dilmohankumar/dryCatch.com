// Central metric definitions (rule #10/#73/#74) — every dashboard/report
// reads these formulas from here, never reinvents its own. If a formula
// needs to change, it changes in exactly one place.

// Gross Sales = product sales before discounts/refunds.
export function grossSales(row) {
  return row.grossSales || 0;
}

// Net Sales = gross sales - discounts - refunds. This project has no
// separate "returns" concept distinct from refunds (Phase 9/Phase 8 model
// returns as refunds), so "returns" in the spec maps to refundAmount here.
export function netSales(row) {
  return (row.grossSales || 0) - (row.discountAmount || 0) - (row.refundAmount || 0);
}

export function totalOrderValue(row) {
  return netSales(row) + (row.taxAmount || 0) + (row.shippingRevenue || 0);
}

// AOV excludes cancelled orders from the denominator (rule #15) — a
// cancelled order never contributed real revenue, so it shouldn't dilute
// the average.
export function averageOrderValue(row) {
  const eligibleOrders = (row.ordersCount || 0) - (row.cancelledCount || 0);
  if (eligibleOrders <= 0) return 0;
  return netSales(row) / eligibleOrders;
}

export function refundRate(row) {
  if (!row.ordersCount) return 0;
  return (row.refundedCount || 0) / row.ordersCount;
}

export function cancellationRate(row) {
  if (!row.ordersCount) return 0;
  return (row.cancelledCount || 0) / row.ordersCount;
}

// Conversion = orders / visitors, from the funnel aggregate (rule #47).
export function conversionRate(funnelRow) {
  if (!funnelRow?.visitors) return 0;
  return (funnelRow.orderCompleted || 0) / funnelRow.visitors;
}

export function percentChange(current, previous) {
  if (!previous) return current > 0 ? 1 : 0; // no prior baseline — treat any current value as a 100% increase, 0 if both are 0
  return (current - previous) / previous;
}

// Historical CLV (rule #18) — the only model implemented today. Predictive
// CLV (projecting future spend) and Cohort CLV (segmented by acquisition
// cohort) are NOT implemented — both need a statistical model this project
// has no data science layer for; documented gap rather than a fabricated
// number.
export function historicalCLV(totalNetRevenue, distinctCustomerCount) {
  if (!distinctCustomerCount) return 0;
  return totalNetRevenue / distinctCustomerCount;
}

// Percentile from a (possibly sampled) sorted array — used for shipping
// delivery-time P50/P90/P95 (rule #35). Linear interpolation, nearest-rank
// fallback for small arrays.
export function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (idx - lower);
}
