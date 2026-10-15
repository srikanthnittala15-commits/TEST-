import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();

  // The database lets the admin read only these two tables. Individual entries are never reachable.
  const [{ data: summaries }, { data: profiles }] = await Promise.all([
    supabase.from("client_summaries").select("*"),
    supabase.from("profiles").select("id,email,full_name").order("email"),
  ]);
  const byUser = new Map((summaries ?? []).map((s) => [s.user_id, s]));
  const rows = (profiles ?? []).map((p) => ({ p, s: byUser.get(p.id) }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Clients</h1>
      <p className="text-sm text-stone-700">Summary numbers only. You cannot see anyone&apos;s individual entries.</p>
      {rows.length === 0 ? <p className="text-stone-700">No clients yet.</p> : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-600">
              <tr>
                <th className="px-3 py-2 font-medium">Client</th><th className="px-3 py-2 font-medium">Goal corpus</th>
                <th className="px-3 py-2 font-medium">SIP required / month</th><th className="px-3 py-2 font-medium">Surplus / deficit</th>
                <th className="px-3 py-2 font-medium">Net worth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {rows.map(({ p, s }) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">{p.full_name ?? p.email}<div className="text-xs text-stone-500">{p.full_name ? p.email : ""}</div></td>
                  {s ? (
                    <>
                      <td className="px-3 py-2">{formatINR(Number(s.total_goal_corpus))}</td>
                      <td className="px-3 py-2">{formatINR(Number(s.monthly_sip_required))}</td>
                      <td className={`px-3 py-2 ${Number(s.monthly_surplus) < 0 ? "text-red-700" : ""}`}>{formatINR(Number(s.monthly_surplus))}</td>
                      <td className="px-3 py-2">{formatINR(Number(s.net_worth))}</td>
                    </>
                  ) : <td className="px-3 py-2 text-stone-500" colSpan={4}>No numbers yet</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
