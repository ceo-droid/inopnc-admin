-- Add checklist material detail columns so "새 항목 등록" data can sync fully.
alter table if exists public.checklists
  add column if not exists supplier text,
  add column if not exists quantity numeric,
  add column if not exists unit_price numeric,
  add column if not exists shipping_type text,
  add column if not exists payment_status text;

-- Backfill supplier for existing material rows where title already stores supplier name.
update public.checklists
set supplier = nullif(trim(title), '')
where type = 'material'
  and coalesce(trim(supplier), '') = ''
  and coalesce(trim(title), '') <> '';
