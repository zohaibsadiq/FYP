/**
 * Prices, written the way a price tag is.
 *
 * Grouping is fixed rather than taken from the browser, because the same
 * amount must not read as "1,00,000" on one phone and "100,000" on another
 * when both people are looking at the same shop.
 */

// Every shop the app reads prices in rupees. Anything else falls through to
// its own code, which is honest and needs no symbol table to maintain.
const SYMBOLS: Record<string, string> = {
  PKR: "Rs",
  USD: "$",
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code?.toUpperCase()] ?? code ?? "";
}

/** "Rs 4,999", or "Rs 1,299.50" when the paisa are not zero. */
export function money(amount: string | number, currency = "PKR"): string {
  // An empty string turns into 0, not into nothing, so a missing price would
  // otherwise be printed as free.
  if (typeof amount === "string" && amount.trim() === "") return "";

  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "";

  const rounded = Math.round(value * 100) / 100;
  const hasPaisa = Math.abs(rounded % 1) > 0.004;

  const digits = rounded.toLocaleString("en-US", {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: hasPaisa ? 2 : 0,
  });

  return `${currencySymbol(currency)} ${digits}`.trim();
}

/** "Rs 1,000 off", only when there is really something off. */
export function savingLabel(saving: string | null, currency = "PKR"): string {
  if (!saving) return "";
  const value = Number(saving);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${money(value, currency)} off`;
}
