import { addGoal, deleteGoal, updateGoal } from "./actions";
import { LineChart } from "@/components/LineChart";
import { analyzeGoal, projectionSeries, type GoalInput } from "@/lib/calc/goal";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";
const field = "w-full rounded-lg border border-stone-300 px-3 py-2";

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireUser();
  const { error } = await searchParams;
  const { data: goals } = await supabase.from("goals").select("*").order("created_at");
  const now = new Date();
  const year = now.getFullYear();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Goals</h1>
      {error ? <p role="alert" className="text-sm text-red-700">{error === "invalid" ? "Please check the numbers you entered." : "Could not save. Please try again."}</p> : null}

      {(goals ?? []).length === 0 ? <p className="text-stone-700">No goals yet. Add your first one below.</p> : null}

      {(goals ?? []).map((g) => {
        const input: GoalInput = {
          targetAmountToday: Number(g.target_amount_today), targetYear: g.target_year, inflationRate: Number(g.inflation_rate),
          expectedReturn: Number(g.expected_return), existingCorpus: Number(g.existing_corpus), monthlyContribution: Number(g.monthly_contribution),
        };
        const a = analyzeGoal(input, now);
        const series = projectionSeries(input, now);
        return (
          <section key={g.id} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">{g.name}</h2>
                <p className="text-sm text-stone-600">By {g.target_year}, in today&apos;s cost {formatINR(input.targetAmountToday)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${a.status === "on_track" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>
                {a.status === "on_track" ? "On track" : "Behind"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-stone-600">Target with inflation</dt><dd className="font-medium">{formatINR(a.inflatedTarget)}</dd></div>
              <div><dt className="text-stone-600">Monthly SIP required</dt><dd className="font-medium">{formatINR(a.sipRequired)}</dd></div>
              <div><dt className="text-stone-600">Projected with your current SIP</dt><dd className="font-medium">{formatINR(a.projectedWithCurrent)}</dd></div>
              <div><dt className="text-stone-600">Shortfall</dt><dd className="font-medium">{formatINR(a.shortfall)}</dd></div>
            </dl>
            <LineChart
              caption={`Corpus growth for ${g.name}`}
              xLabel="Years from now"
              series={[
                { name: "With required SIP", color: "#15803d", points: series.map((p) => ({ x: p.years, y: p.withRequiredSip, label: String(Math.round(p.years)) })) },
                { name: "With your current SIP", color: "#b45309", points: series.map((p) => ({ x: p.years, y: p.withCurrent, label: String(Math.round(p.years)) })) },
              ]}
            />
            <form action={updateGoal} className="grid grid-cols-2 gap-3 text-sm">
              <input type="hidden" name="id" value={g.id} />
              <label>Existing corpus (₹)<input name="existing_corpus" inputMode="decimal" defaultValue={Number(g.existing_corpus)} className={field} /></label>
              <label>Current monthly SIP (₹)<input name="monthly_contribution" inputMode="decimal" defaultValue={Number(g.monthly_contribution)} className={field} /></label>
              <button className="col-span-2 rounded-lg border border-stone-300 px-3 py-2 hover:bg-stone-100 sm:col-span-1">Update</button>
            </form>
            <form action={deleteGoal}>
              <input type="hidden" name="id" value={g.id} />
              <button className="text-sm text-red-700 underline">Delete this goal</button>
            </form>
          </section>
        );
      })}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Add a goal</h2>
        <form action={addGoal} className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2">Goal name<input name="name" required maxLength={80} className={field} placeholder="For example: Child's education" /></label>
          <label>Target amount in today&apos;s cost (₹)<input name="target_amount_today" required inputMode="decimal" className={field} /></label>
          <label>Target year<input name="target_year" required inputMode="numeric" defaultValue={year + 10} className={field} /></label>
          <label>Inflation (% per year)<input name="inflation_rate" required inputMode="decimal" defaultValue={6} className={field} /></label>
          <label>Expected return (% per year)<input name="expected_return" required inputMode="decimal" defaultValue={10} className={field} /></label>
          <label>Existing corpus (₹)<input name="existing_corpus" required inputMode="decimal" defaultValue={0} className={field} /></label>
          <label>Current monthly SIP (₹)<input name="monthly_contribution" required inputMode="decimal" defaultValue={0} className={field} /></label>
          <button className="col-span-2 rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700">Add goal</button>
        </form>
        <p className="text-xs text-stone-600">Returns and inflation are your own assumptions. Results are estimates, not a promise.</p>
      </section>
    </div>
  );
}
