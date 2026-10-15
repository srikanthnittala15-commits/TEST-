export type NetWorthItem = { month: string; side: "asset" | "liability"; category: string; amount: number };

export const ASSET_CATEGORIES: Record<string, string> = {
  cash: "Cash", bank: "Bank", fd: "Fixed deposits", mutual_funds: "Mutual funds", stocks: "Stocks",
  retirement: "EPF / PPF / NPS", gold: "Gold", property: "Property", other_asset: "Other assets",
};
export const LIABILITY_CATEGORIES: Record<string, string> = {
  home_loan: "Home loan", car_loan: "Car loan", personal_loan: "Personal loan",
  credit_card: "Credit card", other_liability: "Other liabilities",
};

export function sideOf(category: string): "asset" | "liability" | null {
  if (category in ASSET_CATEGORIES) return "asset";
  if (category in LIABILITY_CATEGORIES) return "liability";
  return null;
}

export function totals(items: Pick<NetWorthItem, "side" | "amount">[]) {
  const assets = items.filter((i) => i.side === "asset").reduce((s, i) => s + Number(i.amount), 0);
  const liabilities = items.filter((i) => i.side === "liability").reduce((s, i) => s + Number(i.amount), 0);
  return { assets, liabilities, netWorth: assets - liabilities };
}

export function assetMix(items: Pick<NetWorthItem, "side" | "category" | "amount">[]) {
  const byCat = new Map<string, number>();
  for (const i of items) if (i.side === "asset") byCat.set(i.category, (byCat.get(i.category) ?? 0) + Number(i.amount));
  const total = [...byCat.values()].reduce((s, v) => s + v, 0);
  return [...byCat.entries()]
    .map(([category, amount]) => ({ category, amount, share: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Net worth per month, oldest first. `month` is YYYY-MM-01. */
export function history(items: NetWorthItem[]) {
  const months = [...new Set(items.map((i) => i.month))].sort();
  return months.map((month) => ({ month, netWorth: totals(items.filter((i) => i.month === month)).netWorth }));
}

/** (bank + cash) / monthly expenses. Null when expenses are unknown or zero. */
export function emergencyFundMonths(items: NetWorthItem[], monthlyExpenses: number): number | null {
  if (monthlyExpenses <= 0) return null;
  const liquid = items
    .filter((i) => i.side === "asset" && (i.category === "bank" || i.category === "cash"))
    .reduce((s, i) => s + Number(i.amount), 0);
  return liquid / monthlyExpenses;
}
