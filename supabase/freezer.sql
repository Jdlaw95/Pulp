-- Freezer stock (frozen compote and filled mousse). Run once in the Supabase SQL editor. Safe to re-run.
-- Run supabase/production-board.sql first.

-- Every stock change is one row. Stock on hand = sum of change per flavour and stage.
create table if not exists public.stock_moves (
  id bigint generated always as identity primary key,
  flavour text not null,
  stage text not null check (stage in ('compote', 'filled')),
  change int not null check (change <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists stock_moves_flavour_stage on public.stock_moves (flavour, stage);
create index if not exists stock_moves_created on public.stock_moves (created_at desc);

-- Totals per flavour and stage, so the dashboard never has to read the whole ledger.
-- security_invoker makes the view obey the table's row-level security (the public key sees nothing).
create or replace view public.stock_levels with (security_invoker = true) as
  select flavour, stage, sum(change)::int as qty
  from public.stock_moves
  group by flavour, stage;

-- Mould size and par levels per flavour.
create table if not exists public.stock_settings (
  flavour text primary key,
  mould_size int not null default 6 check (mould_size between 1 and 60),
  par_compote int not null default 0 check (par_compote >= 0),
  par_filled int not null default 0 check (par_filled >= 0)
);

-- Starting values for every current flavour: strawberry moulds hold 15, the rest hold 6. Par = one mould.
-- Existing rows are left alone, so re-running never overwrites changes made in the dashboard.
insert into public.stock_settings (flavour, mould_size, par_compote, par_filled)
select name,
       case when name ilike '%strawberr%' then 15 else 6 end,
       case when name ilike '%strawberr%' then 15 else 6 end,
       case when name ilike '%strawberr%' then 15 else 6 end
from public.products
where type = 'single'
on conflict (flavour) do nothing;

alter table public.stock_moves enable row level security;
alter table public.stock_settings enable row level security;
-- No policies on purpose: only the server (service key) reads and writes these, after checking the admin login.
