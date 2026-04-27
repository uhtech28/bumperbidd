/**
 * Indian currency formatting helpers. Uses the en-IN locale so grouping
 * follows the lakh/crore convention (12,85,000) rather than thousands
 * (1,285,000), which is what Indian users expect on a marketplace.
 */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrShort = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 1,
});

export function formatINR(value: number): string {
  return inr.format(value);
}

/**
 * Compact form for tight spaces: ₹12.85L, ₹3.64Cr.
 * Falls back to full formatting below 1 lakh.
 */
export function formatINRCompact(value: number): string {
  if (value >= 1e7) return `₹${inrShort.format(value / 1e7)}Cr`;
  if (value >= 1e5) return `₹${inrShort.format(value / 1e5)}L`;
  if (value >= 1e3) return `₹${inrShort.format(value / 1e3)}K`;
  return formatINR(value);
}

export function formatRelativeMinutes(min: number): string {
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
