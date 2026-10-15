"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { num, text } from "@/lib/form";
import { parseMonth, previousMonth } from "@/lib/month";
import { syncSummary } from "@/lib/summary";

const KINDS = ["income", "fixed", "variable", "emi", "savings"];

export async function addBudgetItem(form: FormData) {
  const { supabase, user } = await requireUser();
  const month = parseMonth(String(form.get("month")));
  const kind = String(form.get("kind"));
  const name = text(form, "name");
  const amount = num(form, "amount");
  if (!KINDS.includes(kind) || !name || amount === null) redirect(`/budget?month=${month.slice(0, 7)}&error=invalid`);
  const { error } = await supabase.from("budget_items").insert({ month, kind, name, amount });
  if (error) redirect(`/budget?month=${month.slice(0, 7)}&error=save`);
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect(`/budget?month=${month.slice(0, 7)}`);
}

export async function deleteBudgetItem(form: FormData) {
  const { supabase, user } = await requireUser();
  const month = parseMonth(String(form.get("month")));
  const id = text(form, "id", 64);
  if (id) await supabase.from("budget_items").delete().eq("id", id);
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect(`/budget?month=${month.slice(0, 7)}`);
}

export async function copyPreviousMonth(form: FormData) {
  const { supabase, user } = await requireUser();
  const month = parseMonth(String(form.get("month")));
  const { count } = await supabase.from("budget_items").select("id", { count: "exact", head: true }).eq("month", month);
  if (!count) {
    const { data } = await supabase.from("budget_items").select("kind,name,amount").eq("month", previousMonth(month));
    if (data?.length) await supabase.from("budget_items").insert(data.map((d) => ({ ...d, month })));
  }
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect(`/budget?month=${month.slice(0, 7)}`);
}
