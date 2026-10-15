-- Client Finance Planner: Phase 1 data model, RLS and admin summary.
-- Principle: a client sees only their own rows. The admin sees ONLY client_summaries
-- (and basic profile identity), never goals, budget lines or net worth lines.

create extension if not exists "pgcrypto";

-- Admin role is set by email in this config table, never self-selected.
create table public.admin_emails (
  email text primary key check (email = lower(email))
);
alter table public.admin_emails enable row level security;
-- No policies on purpose: nobody can read or write it through the API.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_emails a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid()
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- DPDP Act 2023: record of consent, one row per user and policy version.
create table public.consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  target_amount_today numeric not null check (target_amount_today >= 0),
  target_year int not null,
  inflation_rate numeric not null default 6 check (inflation_rate >= 0),
  expected_return numeric not null default 10 check (expected_return >= 0),
  existing_corpus numeric not null default 0 check (existing_corpus >= 0),
  created_at timestamptz not null default now()
);

-- month is the first day of the month.
create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  kind text not null check (kind in ('income', 'fixed', 'variable', 'emi', 'savings')),
  name text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table public.net_worth_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  side text not null check (side in ('asset', 'liability')),
  category text not null check (category in (
    'cash', 'bank', 'fd', 'mutual_funds', 'stocks', 'retirement', 'gold', 'property', 'other_asset',
    'home_loan', 'car_loan', 'personal_loan', 'credit_card', 'other_liability')),
  name text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

-- Summary numbers only. Computed in the client with /lib/calc and saved here;
-- this is the single table the admin can read.
create table public.client_summaries (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_goal_corpus numeric not null default 0,
  monthly_sip_required numeric not null default 0,
  monthly_surplus numeric not null default 0,
  net_worth numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index on public.goals (user_id);
create index on public.budget_items (user_id, month);
create index on public.net_worth_items (user_id, month);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.goals enable row level security;
alter table public.budget_items enable row level security;
alter table public.net_worth_items enable row level security;
alter table public.client_summaries enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "admin reads profiles" on public.profiles for select using (public.is_admin());
create policy "update own name" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own consents read" on public.consents for select using (user_id = auth.uid());
create policy "own consents insert" on public.consents for insert with check (user_id = auth.uid());

create policy "own goals" on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own budget" on public.budget_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own net worth" on public.net_worth_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own summary" on public.client_summaries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin reads summaries" on public.client_summaries for select using (public.is_admin());
-- Deliberately no admin policy on goals, budget_items, net_worth_items or consents.
