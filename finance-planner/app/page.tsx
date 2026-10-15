import Link from "next/link";
import { analyzeGoal } from "@/lib/calc/goal";
import { summarizeMonth, type BudgetKind } from "@/lib/calc/budget";
import { emergencyFundMonths, totals, type NetWorthItem } from "@/lib/calc/networth";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/format";
import { formatMonth } from "@/lib/month";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { supabase, user } = await requireUser();
  const [goalsRes, budgetRes, nwRes] = await Promise.all([
    supabase.from("goals").select("*").order("created_at"),
    supabase.from("budget_items").select("month,kind,amount"),
    supabase.from("net_worth_items").select("month,side,category,amount"),
  ]);
  const goals = goalsRes.data ?? [];
  const budget = (budgetRes.data ?? []).map((b) => ({ ...b, kind: b.kind as BudgetKind, amount: Number(b.amount) }));
  const nw: NetWorthItem[] = (nwRes.data ?? []).map((n) => ({ ...n, side: n.side as "asset" | "liability", amount: Number(n.amount) }));

  const bMonth = budget.map((b) => b.month).sort().at(-1);
  const nMonth = nw.map((n) => n.month).sort().at(-1);
  const month = bMonth ? summarizeMonth(budget.filter((b) => b.month === bMonth)) : null;
  const nwNow = nMonth ? nw.filter((n) => n.month === nMonth) : [];
  const efund = month ? emergencyFundMonths(nwNow, month.expenses) : null;
  const now = new Date();
  const statuses = goals.map((g) => ({
    id: g.id as string, name: g.name as string,
    a: analyzeGoal({
      targetAmountToday: Number(g.target_amount_today), targetYear: g.target_year, inflationRate: Number(g.inflation_rate),
      expectedReturn: Number(g.expected_return), existingCorpus: Number(g.existing_corpus), monthlyContribution: Number(g.monthly_contribution),
    }, now),
  }));
  const onTrack = statuses.filter((s) => s.a.status === "on_track").length;
  const name = user.user_metadata?.name as string | undefined;
  const card = "rounded-xl border border-stone-200 bg-white p-4";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{name ? `Welcome, ${name}` : "Welcome"}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/networth" className={card}><p className="text-sm text-stone-600">Net worth{nMonth ? ` (${formatMonth(nMonth)})` : ""}</p><p className="text-xl font-semibold">{nMonth ? formatINR(totals(nwNow).netWorth) : "Not entered"}</p></Link>
        <Link href="/budget" className={card}>
          <p className="text-sm text-stone-600">Monthly {month && month.surplus < 0 ? "deficit" : "surplus"}{bMonth ? ` (${formatMonth(bMonth)})` : ""}</p>
          <p className={`text-xl font-semibold ${month && month.surplus < 0 ? "text-red-700" : ""}`}>{month ? formatINR(Math.abs(month.surplus)) : "Not entered"}</p>
        </Link>
        <Link href="/goals" className={card}><p className="text-sm text-stone-600">Goals on track</p><p className="text-xl font-semibold">{goals.length ? `${onTrack} of ${goals.length}` : "No goals yet"}</p></Link>
        <div className={card}>
          <p className="text-sm text-stone-600">Emergency fund</p>
          <p className="text-xl font-semibold">{efund === null ? "Needs budget and bank entries" : `${efund.toFixed(1)} months`}</p>
          {efund !== null ? <p className="text-xs text-stone-600">Bank and cash divided by monthly spending</p> : null}
        </div>
      </div>

      {statuses.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Goal status</h2>
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-sm">
            {statuses.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-3 py-2">
                <span>{s.name}</span>
                <span className={s.a.status === "on_track" ? "text-green-800" : "text-amber-800"}>
                  {s.a.status === "on_track" ? "On track" : `SIP needed ${formatINR(s.a.sipRequired)}/month`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : <p className="text-sm text-stone-700">Start with <Link className="underline" href="/goals">a goal</Link>, then add your <Link className="underline" href="/budget">monthly budget</Link> and <Link className="underline" href="/networth">net worth</Link>.</p>}
    </div>
  );
}
