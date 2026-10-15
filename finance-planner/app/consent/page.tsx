import { redirect } from "next/navigation";
import { acceptConsent, declineConsent } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function ConsentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Before you begin</h1>
      <p className="text-stone-700">Your money details are yours. Here is, plainly, how they are handled.</p>

      <section className="space-y-1">
        <h2 className="font-medium">What is stored</h2>
        <p className="text-sm text-stone-700">
          Your name and email from Google sign-in, and what you enter: goals, monthly income and expenses, assets and
          liabilities.
        </p>
      </section>
      <section className="space-y-1">
        <h2 className="font-medium">Who can see it</h2>
        <p className="text-sm text-stone-700">
          Only you can see your entries. Your adviser sees a short summary only: total goal corpus, monthly SIP
          required, monthly surplus or deficit, and net worth. Your individual items are never shown to anyone else.
        </p>
      </section>
      <section className="space-y-1">
        <h2 className="font-medium">How to delete it</h2>
        <p className="text-sm text-stone-700">
          In Settings you can download everything, or delete your account and all your data at any time. You can
          withdraw consent the same way.
        </p>
      </section>

      <div className="flex gap-3">
        <form action={acceptConsent}>
          <button className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700">I understand and agree</button>
        </form>
        <form action={declineConsent}>
          <button className="rounded-lg border border-stone-300 px-4 py-2 hover:bg-stone-100">Not now</button>
        </form>
      </div>
    </div>
  );
}
