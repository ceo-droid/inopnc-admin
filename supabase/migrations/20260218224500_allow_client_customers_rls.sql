-- Fix customer save failures in client-only mode.
-- The app currently writes via anon/publishable key without end-user auth.
-- Allow anon + authenticated roles to read/write customers with basic name validation.

alter table if exists public.customers enable row level security;

drop policy if exists "Allow public access to customers" on public.customers;
drop policy if exists "customers_read_authenticated" on public.customers;
drop policy if exists "customers_insert_authenticated" on public.customers;
drop policy if exists "customers_update_authenticated" on public.customers;
drop policy if exists "customers_delete_authenticated" on public.customers;
drop policy if exists "customers_read_client" on public.customers;
drop policy if exists "customers_insert_client" on public.customers;
drop policy if exists "customers_update_client" on public.customers;
drop policy if exists "customers_delete_client" on public.customers;

grant select, insert, update, delete on table public.customers to anon, authenticated;

create policy "customers_read_client"
  on public.customers
  for select
  to anon, authenticated
  using (true);

create policy "customers_insert_client"
  on public.customers
  for insert
  to anon, authenticated
  with check (length(trim(coalesce(name, ''))) > 0);

create policy "customers_update_client"
  on public.customers
  for update
  to anon, authenticated
  using (true)
  with check (length(trim(coalesce(name, ''))) > 0);

create policy "customers_delete_client"
  on public.customers
  for delete
  to anon, authenticated
  using (true);
