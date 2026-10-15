export type GoalInput = {
  targetAmountToday: number;
  targetYear: number;
  inflationRate: number; // percent per year
  expectedReturn: number; // percent per year
  existingCorpus: number;
  monthlyContribution: number;
};

export type GoalAnalysis = {
  months: number;
  inflatedTarget: number;
  sipRequired: number;
  projectedWithCurrent: number;
  shortfall: number;
  status: "on_track" | "behind";
};

/** Months from `now` to the end of the target year (the month of `now` counts). */
export function monthsToGoal(targetYear: number, now: Date): number {
  return Math.max(0, (targetYear - now.getFullYear()) * 12 + (12 - now.getMonth()));
}

export function inflatedTarget(amountToday: number, inflationPct: number, months: number): number {
  return amountToday * Math.pow(1 + inflationPct / 100, months / 12);
}

/** Future value of a lump sum plus equal month-end contributions. Monthly rate = annual / 12. */
export function futureValue(corpus: number, monthly: number, annualPct: number, months: number): number {
  const i = annualPct / 100 / 12;
  if (months <= 0) return corpus;
  if (i === 0) return corpus + monthly * months;
  const growth = Math.pow(1 + i, months);
  return corpus * growth + (monthly * (growth - 1)) / i;
}

/** Monthly SIP needed so that corpus + SIP reaches target. Zero when the corpus alone is enough. */
export function sipRequired(target: number, corpus: number, annualPct: number, months: number): number {
  const shortfall = target - futureValue(corpus, 0, annualPct, months);
  if (shortfall <= 0) return 0;
  if (months <= 0) return shortfall; // due now: the whole gap must be funded at once
  const i = annualPct / 100 / 12;
  if (i === 0) return shortfall / months;
  return (shortfall * i) / (Math.pow(1 + i, months) - 1);
}

export function analyzeGoal(g: GoalInput, now: Date): GoalAnalysis {
  const months = monthsToGoal(g.targetYear, now);
  const target = inflatedTarget(g.targetAmountToday, g.inflationRate, months);
  const projected = futureValue(g.existingCorpus, g.monthlyContribution, g.expectedReturn, months);
  return {
    months,
    inflatedTarget: target,
    sipRequired: sipRequired(target, g.existingCorpus, g.expectedReturn, months),
    projectedWithCurrent: projected,
    shortfall: Math.max(0, target - projected),
    status: projected >= target ? "on_track" : "behind",
  };
}

export type ProjectionPoint = { years: number; withRequiredSip: number; withCurrent: number };

/** Yearly corpus growth, both with the required SIP and with the current contribution. */
export function projectionSeries(g: GoalInput, now: Date): ProjectionPoint[] {
  const a = analyzeGoal(g, now);
  const steps: number[] = [];
  for (let m = 0; m < a.months; m += 12) steps.push(m);
  steps.push(a.months);
  return steps.map((m) => ({
    years: m / 12,
    withRequiredSip: futureValue(g.existingCorpus, a.sipRequired, g.expectedReturn, m),
    withCurrent: futureValue(g.existingCorpus, g.monthlyContribution, g.expectedReturn, m),
  }));
}
