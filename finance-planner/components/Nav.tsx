import Link from "next/link";
import { SUPABASE_CONFIGURED } from "@/lib/consent";
import { createClient } from "@/lib/supabase/server";

export async function Nav() {
  if (!SUPABASE_CONFIGURED) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  const links = [
    ["/", "Dashboard"], ["/goals", "Goals"], ["/budget", "Budget"], ["/networth", "Net worth"], ["/settings", "Settings"],
    ...(isAdmin ? [["/admin", "Clients"]] : []),
  ];
  return (
    <nav aria-label="Main" className="border-b border-stone-200 bg-white">
      <ul className="mx-auto flex max-w-2xl flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="underline-offset-4 hover:underline">{label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
