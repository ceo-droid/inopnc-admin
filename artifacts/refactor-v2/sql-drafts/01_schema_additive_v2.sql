-- M1 DRAFT ONLY. Deliberately no IF NOT EXISTS: preflight must detect collisions.
alter table public.sites add column site_code text;
alter table public.sites add column operational_customer_id uuid;
alter table public.sites add column contract_supply_amount numeric;
alter table public.sites add column cost_budget_amount numeric;
alter table public.sites add column physical_location_name text;
alter table public.sites add column site_group_key text;

create table public.import_batches (
 id uuid primary key default gen_random_uuid(), source_type text not null, source_namespace text not null,
 filename text not null, source_sha256 text not null, parser_version text not null,
 started_at timestamptz not null default now(), completed_at timestamptz,
 row_count bigint, insert_count bigint, duplicate_count bigint, review_count bigint,
 status text not null, created_by uuid, metadata jsonb
);
create table public.customer_aliases (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null,
 alias_name text not null, alias_type text not null, is_active boolean not null default true,
 source_type text, source_fingerprint text, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), created_by uuid, updated_by uuid
);
create table public.expense_allocations (
 id uuid primary key default gen_random_uuid(), transaction_id uuid not null,
 site_id uuid, work_log_id uuid, category text not null, allocated_amount numeric not null,
 allocation_status text not null, mapping_basis text, review_reason text,
 is_active boolean not null default true, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), created_by uuid, updated_by uuid
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null,
 action text not null, before_json jsonb, after_json jsonb, reason text, actor_id uuid,
 source text not null, created_at timestamptz not null default now()
);
create table public.app_user_roles (
 user_id uuid primary key, role text not null, company_scope text,
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.site_access (
 user_id uuid not null, site_id uuid not null, access_level text not null,
 created_at timestamptz not null default now(), primary key(user_id,site_id)
);

alter table public.work_logs add column work_date date;
alter table public.work_logs add column site_uuid uuid;
alter table public.work_logs add column worker_uuid uuid;
alter table public.work_logs add column entry_type text;
alter table public.work_logs add column raw_md numeric;
alter table public.work_logs add column countable_md numeric;
alter table public.work_logs add column daily_rate_snapshot numeric;
alter table public.work_logs add column labor_amount numeric;
alter table public.work_logs add column labor_source text;
alter table public.work_logs add column cost_scope text;
alter table public.work_logs add column source_type text;
alter table public.work_logs add column source_namespace text;
alter table public.work_logs add column source_row_key text;
alter table public.work_logs add column source_fingerprint text;
alter table public.work_logs add column import_batch_id uuid;
alter table public.work_logs add column mapping_status text;
alter table public.work_logs add column mapping_basis text;
alter table public.work_logs add column review_reason text;
alter table public.work_logs add column is_active boolean;
alter table public.work_logs add column superseded_by uuid;

alter table public.transactions add column transaction_date date;
alter table public.transactions add column approved_at timestamptz;
alter table public.transactions add column source_type text;
alter table public.transactions add column source_namespace text;
alter table public.transactions add column worker_id uuid;
alter table public.transactions add column card_last4 text;
alter table public.transactions add column approval_no text;
alter table public.transactions add column merchant text;
alter table public.transactions add column original_amount numeric;
alter table public.transactions add column source_category text;
alter table public.transactions add column source_row_key text;
alter table public.transactions add column source_fingerprint text;
alter table public.transactions add column import_batch_id uuid;
alter table public.transactions add column status text;
alter table public.transactions add column is_void boolean;
alter table public.transactions add column superseded_by uuid;
-- Allocation status is derived from active allocations; it is not duplicated here.

alter table public.checklists add column direction text;
alter table public.checklists add column invoice_status text;
alter table public.checklists add column settlement_status text;
alter table public.checklists add column due_date date;
alter table public.checklists add column supply_amount numeric;
alter table public.checklists add column vat_amount numeric;
alter table public.checklists add column total_amount numeric;
alter table public.checklists add column customer_id uuid;
alter table public.checklists add column site_uuid uuid;
alter table public.checklists add column raw_text text;

alter table public.customer_aliases enable row level security;
alter table public.expense_allocations enable row level security;
alter table public.import_batches enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_user_roles enable row level security;
alter table public.site_access enable row level security;

