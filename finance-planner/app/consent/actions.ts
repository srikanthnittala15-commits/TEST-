"use server";

import { redirect } from "next/navigation";
import { CONSENT_VERSION } from "@/lib/consent";
import { createClient } from "@/lib/supabase/server";

export async function acceptConsent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase
    .from("consents")
    .upsert({ user_id: user.id, version: CONSENT_VERSION }, { onConflict: "user_id,version" });
  if (error) throw new Error("Could not save your consent. Please try again.");
  redirect("/");
}

export async function declineConsent() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
