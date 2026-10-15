export type BudgetKind = "income" | "fixed" | "variable" | "emi" | "savings";
export const EXPENSE_KINDS: BudgetKind[] = ["fixed", "variable", "emi", "savings"];

export type MonthSummary = {
  income: number;
  fixed: number;
  variable: number;
  emi: number;
  savings: number;
  expenses: number; // fixed + variable + EMIs (what is spent, excluding savings)
  surplus: number; // income - expenses - savings; negative means a deficit
  savingsRate: number; // savings / income, 0 to 1
};

export function summarizeMonth(items: { kind: BudgetKind; amount: number }[]): MonthSummary {
  const sum = (k: BudgetKind) => items.filter((i) => i.kind === k).reduce((s, i) => s + Number(i.amount), 0);
  const income = sum("income");
  const fixed = sum("fixed");
  const variable = sum("variable");
  const emi = sum("emi");
  const savings = sum("savings");
  const expenses = fixed + variable + emi;
  return {
    income, fixed, variable, emi, savings, expenses,
    surplus: income - expenses - savings,
    savingsRate: income > 0 ? savings / income : 0,
  };
}

export function compareMonths(current: MonthSummary, previous: MonthSummary) {
  return {
    income: current.income - previous.income,
    expenses: current.expenses - previous.expenses,
    savings: current.savings - previous.savings,
    surplus: current.surplus - previous.surplus,
  };
}
