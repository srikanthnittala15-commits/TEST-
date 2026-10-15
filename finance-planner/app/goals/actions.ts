"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { num, text } from "@/lib/form";
import { syncSummary } from "@/lib/summary";

export async function addGoal(form: FormData) {
  const { supabase, user } = await requireUser();
  const name = text(form, "name");
  const target = num(form, "target_amount_today", 1);
  const year = num(form, "target_year", new Date().getFullYear(), 2100);
  const inflation = num(form, "inflation_rate", 0, 50);
  const ret = num(form, "expected_return", 0, 50);
  const corpus = num(form, "existing_corpus");
  const contribution = num(form, "monthly_contribution");
  if (!name || target === null || year === null || inflation === null || ret === null || corpus === null || contribution === null) {
    redirect("/goals?error=invalid");
  }
  const { error } = await supabase.from("goals").insert({
    name, target_amount_today: target, target_year: Math.floor(year), inflation_rate: inflation,
    expected_return: ret, existing_corpus: corpus, monthly_contribution: contribution,
  });
  if (error) redirect("/goals?error=save");
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect("/goals");
}

export async function updateGoal(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(form, "id", 64);
  const corpus = num(form, "existing_corpus");
  const contribution = num(form, "monthly_contribution");
  if (!id || corpus === null || contribution === null) redirect("/goals?error=invalid");
  const { error } = await supabase.from("goals").update({ existing_corpus: corpus, monthly_contribution: contribution }).eq("id", id);
  if (error) redirect("/goals?error=save");
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect("/goals");
}

export async function deleteGoal(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(form, "id", 64);
  if (!id) redirect("/goals?error=invalid");
  await supabase.from("goals").delete().eq("id", id);
  await syncSummary(supabase, user.id);
  revalidatePath("/", "layout");
  redirect("/goals");
}
