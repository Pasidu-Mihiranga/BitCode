/** Format integer cents as Sri Lankan Rupees (e.g. LKR 7,999.00). */
export function formatLkr(cents: number): string {
  const amount = (cents / 100).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `LKR ${amount}`;
}

/** Short label for admin form fields. */
export const CURRENCY_LABEL = "LKR";
