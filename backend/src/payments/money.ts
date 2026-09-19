/**
 * Money helpers. Amounts are integer cents (SGD) everywhere past this file —
 * the free-text price strings on programs and classes stop here.
 */

/**
 * Reads a display price such as "SGD 75", "$35.50", "75" or "Free" into cents.
 * Returns 0 for anything without a number, which covers the "Included in
 * membership" and "Free on membership" labels.
 */
export function parsePriceToCents(price: string | null | undefined): number {
  if (!price) return 0;
  // First number in the string, allowing thousands separators and decimals.
  const match = price.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  if (!match) return 0;
  return Math.round(Number(match[0]) * 100);
}

export function formatCents(cents: number, currency = "SGD"): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}
