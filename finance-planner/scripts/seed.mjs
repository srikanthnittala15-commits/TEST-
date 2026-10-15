// Seeds 3 demo clients. Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).
// Run: node --env-file=.env.local scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const month = new Date().toISOString().slice(0, 8) + "01";
const clients = [
  {
    email: "demo.asha@example.com", name: "Asha Rao",
    goals: [{ name: "Child's education", target_amount_today: 2500000, target_year: 2040, existing_corpus: 300000 }],
    budget: [["income", "Salary", 120000], ["fixed", "Rent", 30000], ["variable", "Groceries", 15000], ["emi", "Car loan", 12000], ["savings", "Monthly SIP", 20000]],
    nw: [["asset", "bank", "Savings account", 250000], ["asset", "retirement", "EPF", 900000], ["liability", "car_loan", "Car loan", 400000]],
  },
  {
    email: "demo.ravi@example.com", name: "Ravi Kumar",
    goals: [{ name: "Retirement", target_amount_today: 30000000, target_year: 2050, existing_corpus: 1500000 }, { name: "Home down payment", target_amount_today: 2000000, target_year: 2031, existing_corpus: 200000 }],
    budget: [["income", "Salary", 200000], ["fixed", "Rent", 40000], ["variable", "Household", 35000], ["savings", "Monthly SIP", 50000]],
    nw: [["asset", "bank", "Savings account", 600000], ["asset", "gold", "Gold", 300000], ["asset", "mutual_funds", "Long-term savings", 1800000]],
  },
  {
    email: "demo.meena@example.com", name: "Meena Iyer",
    goals: [{ name: "Daughter's wedding", target_amount_today: 1500000, target_year: 2036, existing_corpus: 500000 }],
    budget: [["income", "Pension", 60000], ["income", "Rent received", 25000], ["fixed", "Utilities", 8000], ["variable", "Household", 28000], ["emi", "Home loan", 22000]],
    nw: [["asset", "property", "Flat", 7500000], ["asset", "fd", "Fixed deposits", 1200000], ["liability", "home_loan", "Home loan", 1800000]],
  },
];

for (const c of clients) {
  const { data, error } = await db.auth.admin.createUser({
    email: c.email, email_confirm: true, user_metadata: { name: c.name },
  });
  if (error) { console.log(`skip ${c.email}: ${error.message}`); continue; }
  const uid = data.user.id;
  await db.from("consents").insert({ user_id: uid, version: "2026-10-v1" });
  await db.from("goals").insert(c.goals.map((g) => ({ ...g, user_id: uid })));
  await db.from("budget_items").insert(c.budget.map(([kind, name, amount]) => ({ user_id: uid, month, kind, name, amount })));
  await db.from("net_worth_items").insert(c.nw.map(([side, category, name, amount]) => ({ user_id: uid, month, side, category, name, amount })));
  console.log(`seeded ${c.email}`);
}
