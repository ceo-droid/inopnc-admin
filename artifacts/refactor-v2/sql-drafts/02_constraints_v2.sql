-- M2 DRAFT ONLY; run only after M1 and explicit pre-constraint validation.
alter table public.sites add constraint sites_operational_customer_fk foreign key (operational_customer_id) references public.customers(id) on delete restrict not valid;
alter table public.customer_aliases add constraint customer_aliases_customer_fk foreign key(customer_id) references public.customers(id) on delete restrict;
alter table public.work_logs add constraint work_logs_site_uuid_fk foreign key(site_uuid) references public.sites(id) on delete restrict not valid;
alter table public.work_logs add constraint work_logs_worker_uuid_fk foreign key(worker_uuid) references public.workers(id) on delete restrict not valid;
alter table public.work_logs add constraint work_logs_import_batch_fk foreign key(import_batch_id) references public.import_batches(id) on delete set null not valid;
alter table public.work_logs add constraint work_logs_superseded_fk foreign key(superseded_by) references public.work_logs(id) on delete restrict not valid;
alter table public.transactions add constraint transactions_worker_fk foreign key(worker_id) references public.workers(id) on delete restrict not valid;
alter table public.transactions add constraint transactions_import_batch_fk foreign key(import_batch_id) references public.import_batches(id) on delete set null not valid;
alter table public.transactions add constraint transactions_superseded_fk foreign key(superseded_by) references public.transactions(id) on delete restrict not valid;
alter table public.expense_allocations add constraint allocations_transaction_fk foreign key(transaction_id) references public.transactions(id) on delete restrict;
alter table public.expense_allocations add constraint allocations_site_fk foreign key(site_id) references public.sites(id) on delete restrict;
alter table public.expense_allocations add constraint allocations_work_log_fk foreign key(work_log_id) references public.work_logs(id) on delete set null;
alter table public.checklists add constraint checklists_customer_fk foreign key(customer_id) references public.customers(id) on delete restrict not valid;
alter table public.checklists add constraint checklists_site_uuid_fk foreign key(site_uuid) references public.sites(id) on delete restrict not valid;
alter table public.site_access add constraint site_access_site_fk foreign key(site_id) references public.sites(id) on delete restrict;

alter table public.work_logs add constraint work_logs_v2_values check(raw_md >= 0 and countable_md >= 0 and daily_rate_snapshot >= 0 and labor_amount >= 0) not valid;
alter table public.work_logs add constraint work_logs_labor_source check(labor_source in ('CALCULATED','MANUAL_OVERRIDE','HISTORICAL_IMPORT')) not valid;
alter table public.work_logs add constraint work_logs_cost_scope check(cost_scope in ('SITE','OVERHEAD','NONE')) not valid;
alter table public.work_logs add constraint work_logs_entry_type check(entry_type in ('NORMAL_WORK','HOLIDAY','OTHER')) not valid;
alter table public.expense_allocations add constraint allocations_positive check(allocated_amount > 0);
alter table public.expense_allocations add constraint allocations_status check(allocation_status in ('ACTIVE','VOID','SUPERSEDED'));
alter table public.transactions add constraint transactions_source_type check(source_type in ('CARD','MANUAL','IMPORT')) not valid;
alter table public.transactions add constraint transactions_status check(status in ('ACTIVE','VOID','SUPERSEDED')) not valid;
alter table public.customer_aliases add constraint customer_alias_type check(alias_type in ('SOURCE','LEGAL','TAX_INVOICE','OPERATIONAL'));

create unique index ux_sites_site_code_nonnull on public.sites(site_code) where site_code is not null;
create unique index ux_work_logs_source_fingerprint on public.work_logs(source_namespace,source_type,source_fingerprint) where source_fingerprint is not null and is_active is true;
create unique index ux_transactions_source_fingerprint on public.transactions(source_namespace,source_type,source_fingerprint) where source_fingerprint is not null and is_void is false;
create index ix_work_logs_work_date_site on public.work_logs(work_date,site_uuid);
create index ix_work_logs_worker_date on public.work_logs(worker_uuid,work_date);
create index ix_transactions_date on public.transactions(transaction_date);
create index ix_transactions_worker_date on public.transactions(worker_id,transaction_date);
create index ix_transactions_card on public.transactions(card_last4,approved_at) where card_last4 is not null;
create index ix_transactions_import_batch on public.transactions(import_batch_id) where import_batch_id is not null;
create index ix_allocations_transaction_active on public.expense_allocations(transaction_id) where is_active is true;
create index ix_allocations_site_active on public.expense_allocations(site_id) where is_active is true;
create index ix_allocations_work_log on public.expense_allocations(work_log_id) where work_log_id is not null;
create index ix_checklists_site_due on public.checklists(site_uuid,due_date);
create index ix_checklists_customer_status on public.checklists(customer_id,invoice_status,settlement_status);

-- Cross-row allocation totals are enforced by one narrow constraint trigger.
-- It serializes changes per source transaction without storing duplicate mapping status.
create function public.check_expense_allocation_total_v2() returns trigger language plpgsql security invoker set search_path=public as $$
declare source_amount numeric; assigned_amount numeric;
begin
 select original_amount into source_amount from public.transactions where id=coalesce(new.transaction_id,old.transaction_id) for update;
 select coalesce(sum(allocated_amount),0) into assigned_amount from public.expense_allocations
 where transaction_id=coalesce(new.transaction_id,old.transaction_id) and is_active is true and allocation_status='ACTIVE';
 if source_amount is null or source_amount < 0 or assigned_amount > source_amount then raise exception 'invalid allocation total'; end if;
 return coalesce(new,old);
end $$;
create constraint trigger expense_allocation_total_guard after insert or update on public.expense_allocations
deferrable initially immediate for each row execute function public.check_expense_allocation_total_v2();

