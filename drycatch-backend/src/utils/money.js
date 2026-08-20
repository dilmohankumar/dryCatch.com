// All cart/summary math happens in integer minor units (paise for INR) and
// is only converted back to a decimal rupee amount at the very end — floats
// are never summed directly as a source of financial truth.
export function toMinorUnits(amountInRupees) {
  return Math.round(Number(amountInRupees) * 100);
}

export function fromMinorUnits(minorUnits) {
  return minorUnits / 100;
}

export function sumMinorUnits(amounts) {
  return amounts.reduce((sum, a) => sum + a, 0);
}
