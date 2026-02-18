-- 1) Merge duplicate sites by normalized name (trim + no spaces + lowercase)
with ranked as (
  select
    id,
    lower(regexp_replace(trim(name), '\s+', '', 'g')) as norm_name,
    first_value(id) over (
      partition by lower(regexp_replace(trim(name), '\s+', '', 'g'))
      order by created_at asc nulls last, id asc
    ) as keep_id,
    row_number() over (
      partition by lower(regexp_replace(trim(name), '\s+', '', 'g'))
      order by created_at asc nulls last, id asc
    ) as rn
  from public.sites
), to_merge as (
  select id as drop_id, keep_id
  from ranked
  where rn > 1
), upd_tx as (
  update public.transactions t
  set site_id = m.keep_id::text
  from to_merge m
  where t.site_id = m.drop_id::text
  returning t.id
), upd_wl as (
  update public.work_logs w
  set site_id = m.keep_id::text
  from to_merge m
  where w.site_id = m.drop_id::text
  returning w.id
)
delete from public.sites s
using to_merge m
where s.id = m.drop_id;

-- 2) Merge duplicate workers by normalized name
with ranked as (
  select
    id,
    lower(regexp_replace(trim(name), '\s+', '', 'g')) as norm_name,
    first_value(id) over (
      partition by lower(regexp_replace(trim(name), '\s+', '', 'g'))
      order by created_at asc nulls last, id asc
    ) as keep_id,
    row_number() over (
      partition by lower(regexp_replace(trim(name), '\s+', '', 'g'))
      order by created_at asc nulls last, id asc
    ) as rn
  from public.workers
), to_merge as (
  select id as drop_id, keep_id
  from ranked
  where rn > 1
), upd_wl as (
  update public.work_logs w
  set worker_id = m.keep_id::text
  from to_merge m
  where w.worker_id = m.drop_id::text
  returning w.id
)
delete from public.workers wk
using to_merge m
where wk.id = m.drop_id;

-- 3) Remove duplicates from business keys before adding unique indexes
with ranked as (
  select
    id,
    row_number() over (
      partition by date, worker_id, site_id, md
      order by created_at asc nulls last, id asc
    ) as rn
  from public.work_logs
)
delete from public.work_logs w
using ranked r
where w.id = r.id
  and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by date, coalesce(trim(description), ''), amount
      order by created_at asc nulls last, id asc
    ) as rn
  from public.transactions
)
delete from public.transactions t
using ranked r
where t.id = r.id
  and r.rn > 1;

-- 4) Add unique indexes as the final guardrail
create unique index if not exists ux_sites_name_norm
  on public.sites ((lower(regexp_replace(trim(name), '\s+', '', 'g'))));

create unique index if not exists ux_workers_name_norm
  on public.workers ((lower(regexp_replace(trim(name), '\s+', '', 'g'))));

create unique index if not exists ux_work_logs_business_key
  on public.work_logs (date, worker_id, site_id, md);

create unique index if not exists ux_transactions_business_key
  on public.transactions (date, (coalesce(trim(description), '')), amount);
