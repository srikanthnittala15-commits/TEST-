import { addNetWorthItem, copyPreviousNetWorth, deleteNetWorthItem } from "./actions";
import { LineChart } from "@/components/LineChart";
import { MonthPicker } from "@/components/MonthPicker";
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES, assetMix, history, totals, type NetWorthItem } from "@/lib/calc/networth";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/format";
import { formatMonth, parseMonth, previousMonth } from "@/lib/month";

export const dynamic = "force-dynamic";
const field = "w-full rounded-lg border border-stone-300 px-3 py-2";
const label = (c: string) => ASSET_CATEGORIES[c] ?? LIABILITY_CATEGORIES[c] ?? c;

export default async function NetWorthPage({ searchParams }: { searchParams: Promise<{ month?: string; error?: string }> }) {
  const sp = await searchParams;
  const month = parseMonth(sp.month);
  const prev = previousMonth(month);
  const { supabase } = await requireUser();
  const { data } = await supabase.from("net_worth_items").select("id,month,side,category,name,amount").order("created_at");
  const all: (NetWorthItem & { id: string; name: string })[] = (data ?? []).map((r) => ({ ...r, side: r.side as "asset" | "liability", amount: Number(r.amount) }));
  const items = all.filter((i) => i.month === month);
  const t = totals(items);
  const mix = assetMix(items);
  const hist = history(all);
  const hasPrev = all.some((i) => i.month === prev);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Net worth: {formatMonth(month)}</h1>
      <MonthPicker month={month} />
      {sp.error ? <p role="alert" className="text-sm text-red-700">Please check what you entered and try again.</p> : null}

      <section className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-stone-600">Assets</p><p className="font-semibold">{formatINR(t.assets)}</p></div>
        <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-stone-600">Liabilities</p><p className="font-semibold">{formatINR(t.liabilities)}</p></div>
        <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-stone-600">Net worth</p><p className={`font-semibold ${t.netWorth < 0 ? "text-red-700" : ""}`}>{formatINR(t.netWorth)}</p></div>
      </section>

      {mix.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Asset mix</h2>
          {mix.map((m) => (
            <div key={m.category} className="text-sm">
              <div className="flex justify-between"><span>{label(m.category)}</span><span>{formatINR(m.amount)} ({(m.share * 100).toFixed(0)}%)</span></div>
              <div className="h-2 rounded bg-stone-200"><div className="h-2 rounded bg-stone-700" style={{ width: `${m.share * 100}%` }} /></div>
            </div>
          ))}
        </section>
      ) : null}

      {hist.length > 1 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Monthly history</h2>
          <LineChart
            caption="Net worth by month"
            xLabel="Month"
            series={[{ name: "Net worth", color: "#1c1917", points: hist.map((h, i) => ({ x: i, y: h.netWorth, label: formatMonth(h.month).replace(" 20", " '") })) }]}
          />
        </section>
      ) : <p className="text-sm text-stone-600">The history chart appears once you have two months of entries.</p>}

      <section className="space-y-2">
        <h2 className="font-medium">Entries</h2>
        {items.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">Nothing entered for this month.</p>
            {hasPrev ? <form action={copyPreviousNetWorth}><input type="hidden" name="month" value={month} /><button className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100">Copy entries from {formatMonth(prev)}</button></form> : null}
          </div>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>{i.name} <span className="text-stone-500">· {label(i.category)}</span></span>
                <span className="flex items-center gap-3">
                  {i.side === "liability" ? "-" : ""}{formatINR(i.amount)}
                  <form action={deleteNetWorthItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="month" value={month} /><button className="text-red-700 underline" aria-label={`Delete ${i.name}`}>Delete</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Add an entry</h2>
        <form action={addNetWorthItem} className="grid grid-cols-2 gap-3 text-sm">
          <input type="hidden" name="month" value={month} />
          <label>Category
            <select name="category" className={field}>
              <optgroup label="Assets">{Object.entries(ASSET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>
              <optgroup label="Liabilities">{Object.entries(LIABILITY_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</optgroup>
            </select>
          </label>
          <label>Amount (₹)<input name="amount" required inputMode="decimal" className={field} /></label>
          <label className="col-span-2">Name<input name="name" required maxLength={80} className={field} placeholder="For example: Savings account, Home loan" /></label>
          <button className="col-span-2 rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700">Add</button>
        </form>
      </section>
    </div>
  );
}
