import { redirect } from "next/navigation";
import { deleteAccount } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="space-y-2">
        <h2 className="font-medium">Export my data</h2>
        <p className="text-sm text-stone-700">Download everything stored about you.</p>
        <div className="flex gap-3 text-sm">
          <a className="underline" href="/api/export?format=json">Download JSON</a>
          <a className="underline" href="/api/export?format=csv">Download CSV</a>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Delete my account and all data</h2>
        <p className="text-sm text-stone-700">This cannot be undone. Type DELETE to confirm.</p>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error === "confirm" ? "Please type DELETE exactly." : "Could not delete the account. Please try again."}
          </p>
        ) : null}
        <form action={deleteAccount} className="flex gap-3">
          <input
            name="confirm"
            aria-label="Type DELETE to confirm"
            className="rounded-lg border border-stone-300 px-3 py-2"
            autoComplete="off"
          />
          <button className="rounded-lg bg-red-700 px-4 py-2 text-white hover:bg-red-800">Delete everything</button>
        </form>
      </section>
    </div>
  );
}
