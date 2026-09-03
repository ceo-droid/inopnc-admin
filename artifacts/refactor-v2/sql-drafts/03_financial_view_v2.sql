-- M4 DRAFT ONLY. PostgreSQL 17.6 supports security_invoker views.
create view public.site_financial_summary_v2 with (security_invoker=true) as
with labor as (
 select site_uuid site_id,sum(labor_amount) actual_labor_cost
 from public.work_logs where is_active is true and cost_scope='SITE' and site_uuid is not null group by site_uuid
), allocation_presence as (
 select distinct transaction_id from public.expense_allocations where is_active is true
), allocated as (
 select a.site_id,sum(a.allocated_amount) actual_expense_cost
 from public.expense_allocations a where a.is_active is true and a.allocation_status='ACTIVE' and a.site_id is not null group by a.site_id
), legacy as (
 select s.id site_id,sum(t.amount) actual_expense_cost from public.transactions t
 join public.sites s on s.id::text=nullif(trim(t.site_id),'')
 where not exists(select 1 from allocation_presence p where p.transaction_id=t.id)
 group by s.id
), expense as (
 select site_id,sum(actual_expense_cost) actual_expense_cost from (
  select * from allocated union all select * from legacy
 ) x group by site_id
)
select s.id site_id,s.site_code,s.name site_name,s.contract_supply_amount,s.cost_budget_amount,
 coalesce(l.actual_labor_cost,0) actual_labor_cost,coalesce(e.actual_expense_cost,0) actual_expense_cost,
 coalesce(l.actual_labor_cost,0)+coalesce(e.actual_expense_cost,0) actual_total_cost,
 case when s.contract_supply_amount is null then null else s.contract_supply_amount-(coalesce(l.actual_labor_cost,0)+coalesce(e.actual_expense_cost,0)) end expected_profit,
 case when s.contract_supply_amount is null or s.contract_supply_amount=0 then null else (coalesce(l.actual_labor_cost,0)+coalesce(e.actual_expense_cost,0))/s.contract_supply_amount end cost_ratio,
 case when s.cost_budget_amount is null then null else s.cost_budget_amount-(coalesce(l.actual_labor_cost,0)+coalesce(e.actual_expense_cost,0)) end cost_budget_remaining
from public.sites s left join labor l on l.site_id=s.id left join expense e on e.site_id=s.id;

