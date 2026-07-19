// Static USD→CAD rate for display. Stay22 prices scraped before the client
// switched to requesting CAD are stored as USD; this converts them for
// display so the whole (Canada-focused) UI reads in CAD. Prices already
// stored as CAD are shown as-is. Mirrors packages/config's usdToCadRate.
const USD_TO_CAD = 1.37;

/** Formats a hotel price in CAD, e.g. "$237 CAD / night". */
export function priceCad(price: {
  amount: number;
  currency: string;
  per: string;
}): string {
  const cad =
    price.currency.toUpperCase() === "CAD"
      ? price.amount
      : price.amount * USD_TO_CAD;
  return `$${Math.round(cad)} CAD / ${price.per}`;
}

/** Title-cases each word, e.g. "north york" → "North York". */
export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
