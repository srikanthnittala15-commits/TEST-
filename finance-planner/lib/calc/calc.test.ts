import { describe, expect, it } from "vitest";
import { analyzeGoal, futureValue, inflatedTarget, monthsToGoal, projectionSeries, sipRequired } from "./goal";
import { compareMonths, summarizeMonth } from "./budget";
import { assetMix, emergencyFundMonths, history, sideOf, totals, type NetWorthItem } from "./networth";
import { buildSummary } from "./summary";
import { currentMonth, formatMonth, parseMonth, previousMonth } from "../month";
import { formatCompactINR } from "../format";

const oct2026 = new Date(2026, 9, 15);

describe("goal maths", () => {
  it("counts months to the end of the target year", () => {
    expect(monthsToGoal(2026, oct2026)).toBe(3);
    expect(monthsToGoal(2027, oct2026)).toBe(15);
    expect(monthsToGoal(2020, oct2026)).toBe(0);
  });
  it("inflates the target", () => {
    expect(inflatedTarget(100000, 6, 12)).toBeCloseTo(106000, 2);
    expect(inflatedTarget(100000, 0, 120)).toBe(100000);
  });
  it("computes SIP with and without returns", () => {
    expect(sipRequired(100000, 0, 0, 12)).toBeCloseTo(8333.33, 2);
    expect(sipRequired(100000, 0, 12, 12)).toBeCloseTo(7884.88, 2);
  });
  it("needs no SIP when the corpus alone suffices, and the full gap when due now", () => {
    expect(sipRequired(100000, 200000, 10, 24)).toBe(0);
    expect(sipRequired(100000, 40000, 10, 0)).toBe(60000);
  });
  it("round-trips: the required SIP reaches the target", () => {
    const sip = sipRequired(5000000, 300000, 10, 180);
    expect(futureValue(300000, sip, 10, 180)).toBeCloseTo(5000000, 0);
  });
  it("reports on-track or behind", () => {
    const base = { targetAmountToday: 1000000, targetYear: 2036, inflationRate: 6, expectedReturn: 10, existingCorpus: 0, monthlyContribution: 0 };
    expect(analyzeGoal(base, oct2026).status).toBe("behind");
    const a = analyzeGoal(base, oct2026);
    expect(analyzeGoal({ ...base, monthlyContribution: a.sipRequired + 1 }, oct2026).status).toBe("on_track");
  });
  it("projects yearly points ending at the target for the required SIP", () => {
    const g = { targetAmountToday: 1000000, targetYear: 2036, inflationRate: 6, expectedReturn: 10, existingCorpus: 100000, monthlyContribution: 0 };
    const pts = projectionSeries(g, oct2026);
    const a = analyzeGoal(g, oct2026);
    expect(pts[0].years).toBe(0);
    expect(pts.at(-1)!.withRequiredSip).toBeCloseTo(a.inflatedTarget, 0);
  });
});

describe("budget", () => {
  const items = [
    { kind: "income" as const, amount: 100000 },
    { kind: "fixed" as const, amount: 30000 },
    { kind: "variable" as const, amount: 20000 },
    { kind: "emi" as const, amount: 10000 },
    { kind: "savings" as const, amount: 25000 },
  ];
  it("summarises a month", () => {
    const s = summarizeMonth(items);
    expect(s.expenses).toBe(60000);
    expect(s.surplus).toBe(15000);
    expect(s.savingsRate).toBe(0.25);
  });
  it("shows a deficit and handles zero income", () => {
    expect(summarizeMonth([{ kind: "fixed", amount: 500 }]).surplus).toBe(-500);
    expect(summarizeMonth([{ kind: "savings", amount: 500 }]).savingsRate).toBe(0);
  });
  it("compares months", () => {
    const d = compareMonths(summarizeMonth(items), summarizeMonth(items.slice(0, 2)));
    expect(d.expenses).toBe(30000);
  });
});

describe("net worth", () => {
  const items: NetWorthItem[] = [
    { month: "2026-09-01", side: "asset", category: "bank", amount: 100 },
    { month: "2026-10-01", side: "asset", category: "bank", amount: 300000 },
    { month: "2026-10-01", side: "asset", category: "cash", amount: 20000 },
    { month: "2026-10-01", side: "asset", category: "gold", amount: 80000 },
    { month: "2026-10-01", side: "liability", category: "car_loan", amount: 100000 },
  ];
  it("totals and history", () => {
    expect(totals(items.filter((i) => i.month === "2026-10-01")).netWorth).toBe(300000);
    expect(history(items).map((h) => h.month)).toEqual(["2026-09-01", "2026-10-01"]);
  });
  it("asset mix shares add to one and sort by size", () => {
    const mix = assetMix(items.filter((i) => i.month === "2026-10-01"));
    expect(mix[0].category).toBe("bank");
    expect(mix.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1, 6);
  });
  it("emergency fund months", () => {
    expect(emergencyFundMonths(items.filter((i) => i.month === "2026-10-01"), 40000)).toBe(8);
    expect(emergencyFundMonths(items, 0)).toBeNull();
  });
  it("knows the side of a category", () => {
    expect(sideOf("gold")).toBe("asset");
    expect(sideOf("home_loan")).toBe("liability");
    expect(sideOf("nonsense")).toBeNull();
  });
});

describe("summary and months", () => {
  it("builds the admin summary from the latest month", () => {
    const s = buildSummary(
      [{ targetAmountToday: 100000, targetYear: 2026, inflationRate: 0, expectedReturn: 0, existingCorpus: 40000, monthlyContribution: 0 }],
      [{ month: "2026-10-01", kind: "income", amount: 5000 }, { month: "2026-09-01", kind: "income", amount: 1 }],
      [{ month: "2026-10-01", side: "asset", category: "bank", amount: 900 }],
      oct2026,
    );
    expect(s.total_goal_corpus).toBe(100000);
    expect(s.monthly_sip_required).toBe(20000);
    expect(s.monthly_surplus).toBe(5000);
    expect(s.net_worth).toBe(900);
  });
  it("handles months", () => {
    expect(currentMonth(oct2026)).toBe("2026-10-01");
    expect(parseMonth("2026-03")).toBe("2026-03-01");
    expect(parseMonth("junk", "2026-01-01")).toBe("2026-01-01");
    expect(previousMonth("2026-01-01")).toBe("2025-12-01");
    expect(formatMonth("2026-10-01")).toBe("Oct 2026");
  });
  it("formats compact rupees", () => {
    expect(formatCompactINR(12500000)).toBe("₹1.25 Cr");
    expect(formatCompactINR(250000)).toBe("₹2.5 L");
    expect(formatCompactINR(5000)).toBe("₹5,000");
  });
});
