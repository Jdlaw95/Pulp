-- Pulp security hardening. Run the parts IN ORDER in the Supabase SQL editor. Each part is safe to re-run.

-- ============ PART A: do this now ============
-- 1) order_items had policies but RLS was switched off, so anyone with your public key could read, change or delete customer orders.
alter table public.order_items enable row level security;

-- 2) Stop people listing every file in the product-images bucket. Images still load from their normal links.
drop policy if exists "Public Read Access" on storage.objects;


-- ============ PART B: after a test order works on Vercel ============
-- The website now saves orders with the service key (SUPABASE_SERVICE_ROLE_KEY on Vercel), so the public no longer needs
-- permission to insert orders directly. Removing these stops anyone posting fake orders or prices straight to your database.
-- ONLY run this once SUPABASE_SERVICE_ROLE_KEY is set on Vercel AND a test order on the live site has worked.
drop policy if exists "Allow public insert orders" on public.orders;
drop policy if exists "Public can insert orders" on public.orders;
drop policy if exists "Allow public insert order_items" on public.order_items;
drop policy if exists "Public can insert order items" on public.order_items;


-- ============ PART C: the dashboard uses the server key, so logged-in users need no direct table access ============
-- The dashboard checks your login on the server and then reads and writes with the service key (SUPABASE_SERVICE_ROLE_KEY).
-- That means the "authenticated" policies below are not needed, and removing them means nobody can read orders or the bank
-- details with just the public key, even if someone managed to sign up. Run this only after the dashboard shows your orders again.
drop policy if exists "Admins can manage orders" on public.orders;
drop policy if exists "orders admin insert" on public.orders;
drop policy if exists "orders admin delete" on public.orders;
drop policy if exists "Admins can manage order_items" on public.order_items;
drop policy if exists "order_items admin insert" on public.order_items;
drop policy if exists "order_items admin delete" on public.order_items;
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "settings admin write" on public.shop_settings;
drop policy if exists "blackout admin write" on public.blackout_dates;
drop policy if exists "private admin only" on public.shop_private;
