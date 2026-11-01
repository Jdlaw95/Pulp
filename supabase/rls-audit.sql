-- Run this in the Supabase SQL Editor and read the result. It lists who can do what on your tables.
-- What you want to see for orders and order_items:
--   * NO policy that lets role "anon" run SELECT, UPDATE or DELETE (that would expose customer names, phones and emails).
--   * Once SUPABASE_SERVICE_ROLE_KEY is set in .env.local and Vercel, you can also remove the anon INSERT policy:
--       drop policy "<policy name>" on public.orders;   -- use the exact name from the list below
--     because the server then inserts orders with the service key.
--   * "authenticated" may SELECT/UPDATE (that is your admin login). Make sure sign-ups are switched off
--     in Supabase > Authentication > Providers > Email, so only you can ever be "authenticated".
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
