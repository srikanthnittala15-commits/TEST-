import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupNotice } from "./SetupNotice";
import { CONSENT_VERSION, SUPABASE_CONFIGURED } from "@/lib/consent";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!SUPABASE_CONFIGURED) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consent } = await supabase
    .from("consents")
    .select("version")
    .eq("version", CONSENT_VERSION)
    .maybeSingle();
  if (!consent) redirect("/consent");

  const { data: isAdmin } = await supabase.rpc("is_admin");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome{user.user_metadata?.name ? `, ${user.user_metadata.name}` : ""}</h1>
      <p className="text-stone-700">
        Your planner is being built in phases. Goals, budget, net worth and your dashboard will appear here.
      </p>
      <ul className="list-disc pl-5 text-sm text-stone-700">
        <li>
          <Link className="underline" href="/settings">
            Settings: export or delete your data
          </Link>
        </li>
        {isAdmin ? <li>You are signed in as admin. The client summary view arrives in a later phase.</li> : null}
      </ul>
    </div>
  );
}
