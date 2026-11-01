-- Pulp upgrade: run once in the Supabase dashboard (SQL Editor). Safe to run again.
-- The site keeps working before you run this; the new features switch on after.

-- 1. Extra order details captured at checkout
alter table public.orders
  add column if not exists box_type text,
  add column if not exists pickup_slot text,
  add column if not exists gift_note text,
  add column if not exists consent_terms_at timestamptz,
  add column if not exists marketing_consent boolean default false;

-- 2. Shop settings (one row) controlled from Admin > Settings
create table if not exists public.shop_settings (
  id int primary key default 1 check (id = 1),
  orders_open boolean not null default true,
  price_trio numeric not null default 75,
  price_box6 numeric not null default 150,
  price_single numeric not null default 28,
  deposit_percent int not null default 50,
  min_notice_days int not null default 2,
  daily_capacity int,
  cutoff_hour int,
  pickup_slots text[] not null default array['Morning (9am to 12pm)','Afternoon (12pm to 4pm)','Evening (4pm to 6pm)'],
  updated_at timestamptz default now()
);
insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

-- 3. Days you are closed
create table if not exists public.blackout_dates (
  date date primary key,
  reason text
);

-- 4. Row-level security: anyone can read settings and closed days; only logged-in admins can change them
alter table public.shop_settings enable row level security;
alter table public.blackout_dates enable row level security;

drop policy if exists "settings readable" on public.shop_settings;
drop policy if exists "settings admin write" on public.shop_settings;
create policy "settings readable" on public.shop_settings for select to anon, authenticated using (true);
create policy "settings admin write" on public.shop_settings for all to authenticated using (true) with check (true);

drop policy if exists "blackout readable" on public.blackout_dates;
drop policy if exists "blackout admin write" on public.blackout_dates;
create policy "blackout readable" on public.blackout_dates for select to anon, authenticated using (true);
create policy "blackout admin write" on public.blackout_dates for all to authenticated using (true) with check (true);

-- Sell a flavour as a pack (for example 2 strawberries for R28). 1 = sold each.
alter table public.products add column if not exists pack_size int not null default 1;

-- Let the signed-in admin add and delete orders from the dashboard.
drop policy if exists "orders admin insert" on public.orders;
drop policy if exists "orders admin delete" on public.orders;
drop policy if exists "order_items admin insert" on public.order_items;
drop policy if exists "order_items admin delete" on public.order_items;
create policy "orders admin insert" on public.orders for insert to authenticated with check (true);
create policy "orders admin delete" on public.orders for delete to authenticated using (true);
create policy "order_items admin insert" on public.order_items for insert to authenticated with check (true);
create policy "order_items admin delete" on public.order_items for delete to authenticated using (true);
