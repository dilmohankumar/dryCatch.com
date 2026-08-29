export function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}
