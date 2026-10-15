const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 1234567 -> "₹12,34,567" */
export function formatINR(amount: number): string {
  return inr.format(Math.round(amount));
}

/** 12500000 -> "₹1.25 Cr", 250000 -> "₹2.5 L". For chart axes and tight spaces. */
export function formatCompactINR(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const n = Math.abs(amount);
  const trim = (v: number) => String(Number(v.toFixed(2)));
  if (n >= 1e7) return `${sign}₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `${sign}₹${trim(n / 1e5)} L`;
  return `${sign}₹${Math.round(n).toLocaleString("en-IN")}`;
}
