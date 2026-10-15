# Client Finance Planner

Planning tool for the practice's clients. Not investment advice. See `CLAUDE.md` for the full spec and phases.

## Setup
1. Create a free Supabase project. Note the project URL, anon key and service role key.
2. In Supabase: Authentication > Providers > Google. Create a Google OAuth client in Google Cloud Console, use the callback URL Supabase shows, and paste the client ID and secret into Supabase.
3. In Supabase: Authentication > URL Configuration. Add `http://localhost:3000/auth/callback` and your Vercel URL + `/auth/callback` as redirect URLs.
4. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor (or `supabase db push`).
5. Run `supabase/seed.sql` to register the admin email (edit it first if needed).
6. `cp .env.example .env.local` and fill in the three values.
7. `npm install && npm run dev`, then open http://localhost:3000.

## Environment variables
| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public anon key; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Account deletion and the seed script. Never expose. |

## Demo data
`node --env-file=.env.local scripts/seed.mjs` creates 3 demo clients (with consent recorded).

## Scripts
`npm run dev`, `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`.

## Deploy (Vercel)
Import the repo, set the root directory to `finance-planner`, add the three environment variables, deploy. Then add the Vercel URL to Supabase redirect URLs.
