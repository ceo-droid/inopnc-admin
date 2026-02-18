-- Harden customers RLS policies:
-- - Remove legacy public-all policy
-- - Allow CRUD only for authenticated users
-- - service_role bypass remains available by Supabase design

alter table if exists public.customers enable row level security;

drop policy if exists "Allow public access to customers" on public.customers;
drop policy if exists "customers_read_authenticated" on public.customers;
drop policy if exists "customers_insert_authenticated" on public.customers;
drop policy if exists "customers_update_authenticated" on public.customers;
drop policy if exists "customers_delete_authenticated" on public.customers;

create policy "customers_read_authenticated"
  on public.customers
  for select
  to authenticated
  using (true);

create policy "customers_insert_authenticated"
  on public.customers
  for insert
  to authenticated
  with check (true);

create policy "customers_update_authenticated"
  on public.customers
  for update
  to authenticated
  using (true)
  with check (true);

create policy "customers_delete_authenticated"
  on public.customers
  for delete
  to authenticated
  using (true);

