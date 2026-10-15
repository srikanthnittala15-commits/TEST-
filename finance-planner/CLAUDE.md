# Client Finance Planner — Build Spec (v1)

## Purpose and scope
A free web app for the practice's clients to plan goals, track monthly cash flow and see their net worth. It is a planning tool only: no product recommendations and no investment advice, ever. Build this in phases.

## Tech stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript + Tailwind |
| Hosting | Vercel |
| Database and auth | Supabase: Postgres, Google sign-in via Supabase Auth, Row Level Security |
| Install | PWA: manifest + service worker, installable from the browser |
| Language | English only |
| Currency | INR, Indian number format (₹12,34,567) |
| Financial year | April to March |

## Roles and access
| Role | Sees | Edits |
|---|---|---|
| client | Only their own data (enforced by RLS) | Their own goals, budget, net worth |
| admin (Srikanth) | Client list with summary numbers only: total goal corpus and monthly SIP required, monthly surplus or deficit, net worth | Nothing |

Admin never sees line items. Admin role is set by email in a config table, not self-selected.

## Modules
### 1. Goal planner
Inputs per goal: name, target amount in today's cost, target year, inflation rate (default 6%), expected return (default 10%), existing corpus.
Outputs: inflated target, monthly SIP required, on-track status, one chart per goal showing corpus growth to target.

### 2. Budget and cash flow
Inputs per month: income sources; expense categories grouped as fixed, variable, EMIs, savings.
Outputs: surplus or deficit, savings rate, expense breakdown, month-over-month comparison.

### 3. Net worth
Assets: cash, bank, FDs, mutual funds, stocks, EPF/PPF/NPS, gold, property, other. Liabilities: home loan, car loan, personal loan, credit card, other.
Outputs: net worth, asset mix, monthly history line chart.

### 4. Dashboard
One screen: net worth, monthly surplus, goal status, emergency fund months (bank + cash ÷ monthly expenses).

## Compliance
- Consent screen on first login (DPDP Act 2023): what is stored, who can see it, how to delete it.
- Settings: export my data (JSON and CSV); delete my account and all data.
- Privacy policy page.
- Footer disclaimer on every page: "This is a planning tool, not investment advice."
- No fund, stock or product names anywhere in the app.

## Engineering rules
- All calculations are pure TypeScript functions in `/lib/calc`, each with unit tests. No calculation logic inside UI components.
- Mobile-first layout.
- Seed script with 3 demo clients.
- README with setup steps, environment variables and deploy steps.
- Build in phases and stop for review after each: (1) data model + auth + consent, (2) goal planner, (3) budget, (4) net worth + dashboard, (5) admin summary view, (6) PWA + deploy.

## Out of scope for v1
AI assistant, Telugu, tax planner, insurance gap check, loan planner, Play Store release.

## Implementation notes (added during build)
- App lives in `finance-planner/` inside the `TEST-` repo, next to the unrelated `tools/` folder.
- Admin privacy is enforced in Postgres: the admin has RLS read access only to `client_summaries` and `profiles`. Summary numbers are computed in the client with `/lib/calc` and saved to `client_summaries`, so calculation logic stays in TypeScript.
- Phase status: all six phases built. Remaining work is account setup (see SETUP-GUIDE.md) and a real-database test of the RLS rules.
- Goal maths: monthly rate = annual / 12; horizon runs to the end of the target year; "on track" compares the projection from the client's current monthly SIP with the inflated target.
- Budget: surplus = income - fixed - variable - EMIs - savings; savings rate = savings / income. Emergency fund uses bank + cash divided by fixed + variable + EMIs.
- Migrations live in `supabase/migrations/` and run in order (0001, 0002).
- The service worker caches only static assets, never pages or API data, because they hold personal finances.
