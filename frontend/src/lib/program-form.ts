export const CLASS_SIZE_OPTIONS = Array.from({ length: 30 }, (_, i) => String(i + 1));

export function parseClassSizeCapacity(classSize: string | null | undefined): number | null {
  const trimmed = String(classSize ?? "").trim();
  if (!trimmed) return null;
  const direct = Number(trimmed);
  if (!Number.isNaN(direct) && direct > 0) return Math.floor(direct);
  const match = trimmed.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function classSizeSelectValue(classSize: string): string {
  const cap = parseClassSizeCapacity(classSize);
  if (cap != null && cap >= 1 && cap <= 30) return String(cap);
  return "";
}

export function normalizeSgdPrice(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^SGD\s/i.test(trimmed)) return trimmed.replace(/^SGD\s+/i, "SGD ");
  const amount = trimmed.replace(/[^\d.,]/g, "").replace(/,/g, "");
  return amount ? `SGD ${amount}` : "";
}

export function sgdPriceAmount(value: string): string {
  return String(value ?? "").replace(/^SGD\s*/i, "").trim();
}

export const STRIPE_LINK_HINT =
  "Create a Payment Link in Stripe (Products → Payment links), paste the https://buy.stripe.com/… URL here, and set After payment → Redirect to: your site /booking/success (e.g. https://dharma-space.com/booking/success). Guests return to the You're all set! confirmation after paying.";

export function isValidStripeLink(url: string): boolean {
  return /^https:\/\/(buy\.)?stripe\.com\//i.test(url.trim());
}
