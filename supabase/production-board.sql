-- Production tick-off board. Run once in the Supabase SQL editor. Safe to re-run.
-- Stores how many of each flavour have been made for a collection date.
-- The amounts NEEDED are still worked out live from orders; this only remembers progress.
create table if not exists public.production_progress (
  date date not null,
  flavour text not null,
  made int not null default 0 check (made >= 0),
  updated_at timestamptz not null default now(),
  primary key (date, flavour)
);

alter table public.production_progress enable row level security;
-- No policies on purpose: only the server (service key) reads and writes this table,
-- after checking the admin login. Same model as security-hardening.sql Part C.
