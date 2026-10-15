import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSummary } from "@/lib/calc/summary";

/** Recomputes the client's summary numbers (the only thing the admin can read) after any change. */
export async function syncSummary(supabase: SupabaseClient, userId: string) {
  const [goals, budget, netWorth] = await Promise.all([
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("budget_items").select("month,kind,amount").eq("user_id", userId),
    supabase.from("net_worth_items").select("month,side,category,amount").eq("user_id", userId),
  ]);
  const summary = buildSummary(
    (goals.data ?? []).map((g) => ({
      targetAmountToday: Number(g.target_amount_today),
      targetYear: g.target_year,
      inflationRate: Number(g.inflation_rate),
      expectedReturn: Number(g.expected_return),
      existingCorpus: Number(g.existing_corpus),
      monthlyContribution: Number(g.monthly_contribution),
    })),
    (budget.data ?? []).map((b) => ({ ...b, amount: Number(b.amount) })),
    (netWorth.data ?? []).map((n) => ({ ...n, amount: Number(n.amount) })),
    new Date(),
  );
  await supabase.from("client_summaries").upsert({ user_id: userId, ...summary, updated_at: new Date().toISOString() });
}
