-- Phase 5.7 minimal additive work_logs V2 schema draft.
-- Draft only. Schema addition is intentionally separated from every data backfill.

-- STEP A: nullable additive columns
ALTER TABLE public.work_logs
  ADD COLUMN IF NOT EXISTS entry_type text,
  ADD COLUMN IF NOT EXISTS raw_md numeric(8, 2),
  ADD COLUMN IF NOT EXISTS countable_md numeric(8, 2),
  ADD COLUMN IF NOT EXISTS labor_amount bigint,
  ADD COLUMN IF NOT EXISTS countable_labor_amount bigint,
  ADD COLUMN IF NOT EXISTS labor_source text,
  ADD COLUMN IF NOT EXISTS cost_scope text,
  ADD COLUMN IF NOT EXISTS source_namespace text,
  ADD COLUMN IF NOT EXISTS source_row_key text,
  ADD COLUMN IF NOT EXISTS source_fingerprint text,
  ADD COLUMN IF NOT EXISTS is_active boolean;

-- STEP B: nullable-safe semantic checks
DO $phase57$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.work_logs'::regclass
      AND conname = 'work_logs_v2_md_semantics_check'
  ) THEN
    ALTER TABLE public.work_logs
      ADD CONSTRAINT work_logs_v2_md_semantics_check
      CHECK (
        (raw_md IS NULL OR raw_md >= 0)
        AND (countable_md IS NULL OR countable_md >= 0)
        AND (raw_md IS NULL OR countable_md IS NULL OR countable_md <= raw_md)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.work_logs'::regclass
      AND conname = 'work_logs_v2_labor_semantics_check'
  ) THEN
    ALTER TABLE public.work_logs
      ADD CONSTRAINT work_logs_v2_labor_semantics_check
      CHECK (
        (labor_amount IS NULL OR labor_amount >= 0)
        AND (countable_labor_amount IS NULL OR countable_labor_amount >= 0)
        AND (
          labor_amount IS NULL
          OR countable_labor_amount IS NULL
          OR countable_labor_amount <= labor_amount
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.work_logs'::regclass
      AND conname = 'work_logs_v2_entry_type_check'
  ) THEN
    ALTER TABLE public.work_logs
      ADD CONSTRAINT work_logs_v2_entry_type_check
      CHECK (entry_type IS NULL OR entry_type IN ('NORMAL', 'OTHER', 'HOLIDAY'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.work_logs'::regclass
      AND conname = 'work_logs_v2_cost_scope_check'
  ) THEN
    ALTER TABLE public.work_logs
      ADD CONSTRAINT work_logs_v2_cost_scope_check
      CHECK (cost_scope IS NULL OR cost_scope IN ('direct', 'overhead', 'none'))
      NOT VALID;
  END IF;
END
$phase57$;

-- STEP C: source identity lookup and active source-managed idempotency
CREATE INDEX IF NOT EXISTS work_logs_v2_source_row_lookup_idx
  ON public.work_logs (source_namespace, source_row_key)
  WHERE is_active IS TRUE
    AND source_namespace IS NOT NULL
    AND source_row_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS work_logs_v2_active_source_fingerprint_uidx
  ON public.work_logs (source_namespace, source_fingerprint)
  WHERE is_active IS TRUE
    AND source_namespace IS NOT NULL
    AND source_fingerprint IS NOT NULL;
