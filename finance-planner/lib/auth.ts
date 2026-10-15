import { redirect } from "next/navigation";
import { CONSENT_VERSION, SUPABASE_CONFIGURED } from "@/lib/consent";
import { createClient } from "@/lib/supabase/server";

/** For signed-in pages: send visitors to setup, login or consent as needed. */
export async function requireUser() {
  if (!SUPABASE_CONFIGURED) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: consent } = await supabase.from("consents").select("version").eq("version", CONSENT_VERSION).maybeSingle();
  if (!consent) redirect("/consent");
  return { supabase, user };
}
