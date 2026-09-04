-- INOPNC Admin Expense Integrity E2
-- DRAFT ONLY. DO NOT APPLY FROM THIS FILE WITHOUT A SEPARATE APPLY REVIEW.
-- Additive only: no DELETE, TRUNCATE, DROP, source UUID replacement, or source-value rewrite.

begin;

alter table public.transactions add column if not exists source_type text;
alter table public.transactions add column if not exists source_namespace text;
alter table public.transactions add column if not exists source_row_key text;
alter table public.transactions add column if not exists source_fingerprint text;
alter table public.transactions add column if not exists is_active boolean not null default true;
alter table public.transactions add column if not exists voided_at timestamptz;
alter table public.transactions add column if not exists void_reason text;
alter table public.transactions add column if not exists supersedes_transaction_id uuid;
alter table public.transactions add column if not exists updated_at timestamptz not null default now();

alter table public.transactions
  add constraint transactions_supersedes_transaction_fk
  foreign key (supersedes_transaction_id) references public.transactions(id) on delete restrict;

alter table public.transactions
  add constraint transactions_source_identity_pair_chk
  check ((source_namespace is null) = (source_row_key is null)) not valid;

alter table public.transactions
  add constraint transactions_void_state_chk
  check ((is_active and voided_at is null) or ((not is_active) and voided_at is not null)) not valid;

create unique index transactions_source_identity_uq
  on public.transactions (source_namespace, source_row_key)
  where source_namespace is not null and source_row_key is not null;

create index transactions_source_fingerprint_idx
  on public.transactions (source_namespace, source_fingerprint)
  where source_fingerprint is not null;

create table if not exists public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  site_id uuid null references public.sites(id) on delete restrict,
  category text not null,
  allocated_amount numeric not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  supersedes_allocation_id uuid null references public.expense_allocations(id) on delete restrict,
  assignment_note text,
  constraint expense_allocations_amount_chk check (allocated_amount >= 0),
  constraint expense_allocations_category_chk check (category in ('아침','점심','저녁','간식','주유','숙박','자재','장비','기타')),
  constraint expense_allocations_void_state_chk check ((is_active and voided_at is null) or ((not is_active) and voided_at is not null))
);

create index if not exists expense_allocations_transaction_idx on public.expense_allocations(transaction_id);
create index if not exists expense_allocations_site_active_idx on public.expense_allocations(site_id) where is_active and voided_at is null;

alter table public.expense_allocations enable row level security;
-- No permissive policy or grant is invented in E2. Review access policy separately before Data API exposure.

create or replace function public.guard_expense_allocation_total()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_amount numeric;
  source_active boolean;
  allocated_total numeric;
begin
  select t.amount, t.is_active into source_amount, source_active
  from public.transactions t where t.id = new.transaction_id for update;
  if not found then raise exception 'expense source transaction not found'; end if;
  if new.is_active and new.voided_at is null and not source_active then
    raise exception 'active allocation requires an active transaction';
  end if;
  if new.is_active and new.voided_at is null then
    select coalesce(sum(a.allocated_amount), 0) into allocated_total
    from public.expense_allocations a
    where a.transaction_id = new.transaction_id
      and a.is_active and a.voided_at is null and a.id <> new.id;
    if allocated_total + new.allocated_amount > source_amount then
      raise exception 'active allocation total exceeds transaction amount';
    end if;
  end if;
  return new;
end;
$$;

create trigger expense_allocations_total_guard
before insert or update of transaction_id, allocated_amount, is_active, voided_at
on public.expense_allocations for each row execute function public.guard_expense_allocation_total();

create view public.expense_active_sources with (security_invoker = true) as
select t.* from public.transactions t where t.is_active and t.voided_at is null;

create view public.expense_financial_read_model with (security_invoker = true) as
select t.id as transaction_id, a.id as allocation_id, a.site_id, a.category,
       a.allocated_amount as amount, false as legacy_site_fallback
from public.transactions t
join public.expense_allocations a on a.transaction_id = t.id
where t.is_active and t.voided_at is null and a.is_active and a.voided_at is null
union all
select t.id, null::uuid, t.site_id, t.category, t.amount, true
from public.transactions t
where t.is_active and t.voided_at is null
  and not exists (select 1 from public.expense_allocations a where a.transaction_id = t.id);

commit;
