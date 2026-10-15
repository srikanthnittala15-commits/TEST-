import { analyzeGoal, type GoalInput } from "./goal";
import { summarizeMonth, type BudgetKind } from "./budget";
import { totals, type NetWorthItem } from "./networth";

export type ClientSummary = {
  total_goal_corpus: number;
  monthly_sip_required: number;
  monthly_surplus: number;
  net_worth: number;
};

/** The only numbers the admin ever sees. Uses the latest month that has data. */
export function buildSummary(
  goals: GoalInput[],
  budget: { month: string; kind: BudgetKind; amount: number }[],
  netWorth: NetWorthItem[],
  now: Date,
): ClientSummary {
  const analyses = goals.map((g) => analyzeGoal(g, now));
  const latest = (months: string[]) => months.sort().at(-1);
  const bMonth = latest(budget.map((b) => b.month));
  const nMonth = latest(netWorth.map((n) => n.month));
  return {
    total_goal_corpus: analyses.reduce((s, a) => s + a.inflatedTarget, 0),
    monthly_sip_required: analyses.reduce((s, a) => s + a.sipRequired, 0),
    monthly_surplus: bMonth ? summarizeMonth(budget.filter((b) => b.month === bMonth)).surplus : 0,
    net_worth: nMonth ? totals(netWorth.filter((n) => n.month === nMonth)).netWorth : 0,
  };
}
