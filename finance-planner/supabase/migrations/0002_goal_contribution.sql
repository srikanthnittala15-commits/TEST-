-- What the client currently invests each month towards a goal; drives the on-track status.
alter table public.goals
  add column monthly_contribution numeric not null default 0 check (monthly_contribution >= 0);
