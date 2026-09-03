-- READ ONLY. Run and archive results before any future schema migration.
select current_setting('server_version') as server_version;
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema='public'
  and table_name in ('customers','sites','workers','work_logs','transactions','checklists')
order by table_name, ordinal_position;
select c.relname as object_name, c.relkind, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' order by c.relname;
select conrelid::regclass as table_name, conname, contype, pg_get_constraintdef(oid) definition
from pg_constraint where connamespace='public'::regnamespace order by 1,2;
select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by 1,2;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by 1,2;
select event_object_table,trigger_name,event_manipulation,action_timing,action_statement
from information_schema.triggers where trigger_schema='public' order by 1,2;
select 'customers' entity,count(*) rows,count(distinct id) uuid_count from public.customers
union all select 'sites',count(*),count(distinct id) from public.sites
union all select 'workers',count(*),count(distinct id) from public.workers
union all select 'work_logs',count(*),count(distinct id) from public.work_logs
union all select 'transactions',count(*),count(distinct id) from public.transactions
union all select 'checklists',count(*),count(distinct id) from public.checklists;
select count(*) budget_rows, count(*) filter(where budget is null) budget_nulls,
       sum(budget) budget_total from public.sites;
select count(*) invalid_site_refs from public.work_logs w
where nullif(trim(w.site_id),'') is not null and not exists(select 1 from public.sites s where s.id::text=w.site_id);
select count(*) invalid_worker_refs from public.work_logs w
where nullif(trim(w.worker_id),'') is not null and not exists(select 1 from public.workers x where x.id::text=w.worker_id);
select count(*) invalid_transaction_site_refs from public.transactions t
where nullif(trim(t.site_id),'') is not null and not exists(select 1 from public.sites s where s.id::text=t.site_id);
-- Expected before M1: these names return zero rows. Any row is a blocking collision.
select table_name,column_name from information_schema.columns where table_schema='public'
and ((table_name='sites' and column_name in ('site_code','operational_customer_id','contract_supply_amount','cost_budget_amount','physical_location_name','site_group_key'))
or (table_name='work_logs' and column_name in ('work_date','site_uuid','worker_uuid','entry_type','raw_md','countable_md','daily_rate_snapshot','labor_amount','labor_source','cost_scope','source_type','source_row_key','source_fingerprint','import_batch_id','mapping_status','mapping_basis','review_reason','is_active','superseded_by'))
or (table_name='transactions' and column_name in ('transaction_date','approved_at','source_type','worker_id','card_last4','approval_no','merchant','original_amount','source_category','source_row_key','source_fingerprint','import_batch_id','status','is_void','superseded_by')));

