import { addBudgetItem, copyPreviousMonth, deleteBudgetItem } from "./actions";
import { MonthPicker } from "@/components/MonthPicker";
import { compareMonths, summarizeMonth, type BudgetKind } from "@/lib/calc/budget";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/format";
import { formatMonth, parseMonth, previousMonth } from "@/lib/month";

export const dynamic = "force-dynamic";
const field = "w-full rounded-lg border border-stone-300 px-3 py-2";
const LABELS: Record<BudgetKind, string> = { income: "Income", fixed: "Fixed expenses", variable: "Variable expenses", emi: "EMIs", savings: "Savings" };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${formatINR(Math.abs(n))}`;

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ month?: string; error?: string }> }) {
  const sp = await searchParams;
  const month = parseMonth(sp.month);
  const prev = previousMonth(month);
  const { supabase } = await requireUser();
  const { data } = await supabase.from("budget_items").select("id,month,kind,name,amount").in("month", [month, prev]).order("created_at");
  const rows = (data ?? []).map((r) => ({ ...r, amount: Number(r.amount), kind: r.kind as BudgetKind }));
  const items = rows.filter((r) => r.month === month);
  const s = summarizeMonth(items);
  const p = summarizeMonth(rows.filter((r) => r.month === prev));
  const d = compareMonths(s, p);
  const hasPrev = rows.some((r) => r.month === prev);
  const outflow = s.expenses + s.savings;
  const bars: [string, number, string][] = [["Fixed", s.fixed, "bg-stone-700"], ["Variable", s.variable, "bg-amber-600"], ["EMIs", s.emi, "bg-red-700"], ["Savings", s.savings, "bg-green-700"]];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Budget: {formatMonth(month)}</h1>
      <MonthPicker month={month} />
      {sp.error ? <p role="alert" className="text-sm text-red-700">Please check what you entered and try again.</p> : null}

      <section className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-stone-600">Income</p><p className="text-lg font-semibold">{formatINR(s.income)}</p></div>
        <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-stone-600">{s.surplus < 0 ? "Deficit" : "Surplus"}</p><p className={`text-lg font-semibold ${s.surplus < 0 ? "text-red-700" : "text-green-800"}`}>{formatINR(Math.abs(s.surplus))}</p></div>
        <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-stone-600">Savings rate</p><p className="text-lg font-semibold">{(s.savingsRate * 100).toFixed(0)}%</p></div>
        <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-stone-600">Spent (excluding savings)</p><p className="text-lg font-semibold">{formatINR(s.expenses)}</p></div>
      </section>

      {outflow > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Where the money goes</h2>
          {bars.map(([label, amt, color]) => (
            <div key={label} className="text-sm">
              <div className="flex justify-between"><span>{label}</span><span>{formatINR(amt)} ({((amt / outflow) * 100).toFixed(0)}%)</span></div>
              <div className="h-2 rounded bg-stone-200"><div className={`h-2 rounded ${color}`} style={{ width: `${(amt / outflow) * 100}%` }} /></div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-medium">Compared with {formatMonth(prev)}</h2>
        {hasPrev ? (
          <ul className="text-sm text-stone-700">
            <li>Income: {signed(d.income)}</li><li>Spending: {signed(d.expenses)}</li><li>Savings: {signed(d.savings)}</li><li>Surplus: {signed(d.surplus)}</li>
          </ul>
        ) : <p className="text-sm text-stone-600">No entries for the previous month yet.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Entries</h2>
        {items.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">Nothing entered for this month.</p>
            {hasPrev ? <form action={copyPreviousMonth}><input type="hidden" name="month" value={month} /><button className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100">Copy entries from {formatMonth(prev)}</button></form> : null}
          </div>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>{i.name} <span className="text-stone-500">· {LABELS[i.kind]}</span></span>
                <span className="flex items-center gap-3">
                  {formatINR(i.amount)}
                  <form action={deleteBudgetItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="month" value={month} /><button className="text-red-700 underline" aria-label={`Delete ${i.name}`}>Delete</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Add an entry</h2>
        <form action={addBudgetItem} className="grid grid-cols-2 gap-3 text-sm">
          <input type="hidden" name="month" value={month} />
          <label>Type<select name="kind" className={field}>{(Object.keys(LABELS) as BudgetKind[]).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}</select></label>
          <label>Amount (₹)<input name="amount" required inputMode="decimal" className={field} /></label>
          <label className="col-span-2">Name<input name="name" required maxLength={80} className={field} placeholder="For example: Salary, Rent, Groceries" /></label>
          <button className="col-span-2 rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700">Add</button>
        </form>
      </section>
    </div>
  );
}
