-- Customers table for supplier/customer management
create table if not exists public.customers (
  id uuid not null default gen_random_uuid() primary key,
  name text not null,
  contact text default '',
  created_at timestamp with time zone not null default now()
);

alter table public.customers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'Allow public access to customers'
  ) then
    create policy "Allow public access to customers"
      on public.customers
      for all
      using (true)
      with check (true);
  end if;
end $$;

-- Prevent duplicate customer names (ignoring case/space)
create unique index if not exists ux_customers_name_norm
  on public.customers ((lower(regexp_replace(trim(name), '\s+', '', 'g'))));

-- Backfill customers from existing site company names
with site_companies as (
  select distinct trim(company_name) as name
  from public.sites
  where company_name is not null
    and trim(company_name) <> ''
)
insert into public.customers (name, contact)
select sc.name, ''
from site_companies sc
where not exists (
  select 1
  from public.customers c
  where lower(regexp_replace(trim(c.name), '\s+', '', 'g')) =
        lower(regexp_replace(trim(sc.name), '\s+', '', 'g'))
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customers'
  ) then
    alter publication supabase_realtime add table public.customers;
  end if;
end $$;
