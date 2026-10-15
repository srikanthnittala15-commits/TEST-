"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sideOf } from "@/lib/calc/networth";
import { requireUser } from "@/lib/auth";
import { num, text } from "@/lib/form";
import { parseMonth, previousMonth } from "@/lib/month";
import { syncSummary } from "@/lib/summary";

export async function addNetWorthItem(form: FormData) {
  const { supabase, user } = await requireUser();
  const month = parseMonth(String(form.get("month")));
  const category = String(form.get("category"));
  const side = sideOf(category);
  const name = text(form, "name");
  const amount = num(form, "amount");
  if (!side || !name || amount === null) redirect(`/networth?month=${month.slice(0, 7)}&error=invalid`);
  const { error } = await supabase.from("net_worth_items").insert({ month, side, category, name, amount });
  if (error) redirect(`/networth?month=${month.slice(0, 7)}&error=save`);
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect(`/networth?month=${month.slice(0, 7)}`);
}

export async function deleteNetWorthItem(form: FormData) {
  const { supabase, user } = await requireUser();
  const month = parseMonth(String(form.get("month")));
  const id = text(form, "id", 64);
  if (id) await supabase.from("net_worth_items").delete().eq("id", id);
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect(`/networth?month=${month.slice(0, 7)}`);
}

export async function copyPreviousNetWorth(form: FormData) {
  const { supabase, user } = await requireUser();
  const month = parseMonth(String(form.get("month")));
  const { count } = await supabase.from("net_worth_items").select("id", { count: "exact", head: true }).eq("month", month);
  if (!count) {
    const { data } = await supabase.from("net_worth_items").select("side,category,name,amount").eq("month", previousMonth(month));
    if (data?.length) await supabase.from("net_worth_items").insert(data.map((d) => ({ ...d, month })));
  }
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect(`/networth?month=${month.slice(0, 7)}`);
}
