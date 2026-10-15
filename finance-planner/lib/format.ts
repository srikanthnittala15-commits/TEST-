const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 1234567 -> "₹12,34,567" */
export function formatINR(amount: number): string {
  return inr.format(Math.round(amount));
}
