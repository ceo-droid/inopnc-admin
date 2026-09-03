-- READ ONLY. Compare these results with archived 00_preflight output.
select 'customers' entity,count(*) rows,count(distinct id) uuid_count from public.customers
union all select 'sites',count(*),count(distinct id) from public.sites
union all select 'workers',count(*),count(distinct id) from public.workers
union all select 'work_logs',count(*),count(distinct id) from public.work_logs
union all select 'transactions',count(*),count(distinct id) from public.transactions
union all select 'checklists',count(*),count(distinct id) from public.checklists;
select table_name,count(*) column_count from information_schema.columns where table_schema='public'
and table_name in ('customer_aliases','expense_allocations','import_batches','audit_logs','app_user_roles','site_access') group by table_name;
select 'customer_aliases' entity,count(*) rows from public.customer_aliases
union all select 'expense_allocations',count(*) from public.expense_allocations
union all select 'import_batches',count(*) from public.import_batches
union all select 'audit_logs',count(*) from public.audit_logs
union all select 'app_user_roles',count(*) from public.app_user_roles
union all select 'site_access',count(*) from public.site_access;
select count(*) unexpected_budget_changes from public.sites where contract_supply_amount is not null;
select count(*) unexpected_worklog_backfill from public.work_logs where work_date is not null or site_uuid is not null or worker_uuid is not null;
select count(*) unexpected_transaction_backfill from public.transactions where transaction_date is not null or original_amount is not null;
select count(*) unexpected_checklist_backfill from public.checklists where direction is not null or invoice_status is not null or settlement_status is not null;
select count(*) site_orphans from public.work_logs w left join public.sites s on s.id=w.site_uuid where w.site_uuid is not null and s.id is null;
select count(*) worker_orphans from public.work_logs w left join public.workers x on x.id=w.worker_uuid where w.worker_uuid is not null and x.id is null;
select count(*) allocation_orphans from public.expense_allocations a left join public.transactions t on t.id=a.transaction_id where t.id is null;
select * from public.site_financial_summary_v2 order by site_code nulls last,site_id;
select count(*) duplicate_count from (select site_code from public.sites where site_code is not null group by site_code having count(*)>1) d;
