"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function signIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Client Finance Planner</h1>
      <p className="text-stone-700">
        A calm place to plan your goals, watch your monthly cash flow and see your net worth. It gives no product
        recommendations and no investment advice.
      </p>
      <button
        onClick={signIn}
        className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-500"
      >
        Continue with Google
      </button>
    </div>
  );
}
