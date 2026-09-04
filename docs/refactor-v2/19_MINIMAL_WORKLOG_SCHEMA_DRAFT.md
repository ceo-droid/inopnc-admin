# Phase 5.7 Minimal Worklog Schema Draft

Status: **PASS — DRAFT ONLY**. The draft is stored outside `supabase/migrations`; it was not applied to any database and contains no worklog backfill.

## Draft scope

The draft adds exactly eleven nullable columns to `public.work_logs`: `entry_type`, `raw_md`, `countable_md`, `labor_amount`, `countable_labor_amount`, `labor_source`, `cost_scope`, `source_namespace`, `source_row_key`, `source_fingerprint`, and `is_active`. It creates no table. The five legacy columns `date`, `site_id`, `worker_id`, `md`, and `note` remain unchanged, so existing screens can continue reading `md` after a future schema-only application.

MD uses `numeric(8,2)` to represent fractional values. Labor values use `bigint`. Semantic vocabularies use text with nullable-safe checks rather than database enums. `entry_type` accepts `NORMAL`, `OTHER`, and `HOLIDAY`; `cost_scope` accepts `direct`, `overhead`, and `none`. `labor_source` remains nullable text until its migration vocabulary is separately approved.

## Safety and representability

The draft performs no data backfill and provides no default that would rewrite the existing 2260 rows. It does not calculate historical labor from `workers.daily`, initialize `is_active`, resolve the five insert conflicts, alter existing UUIDs, or create uniqueness over date/site/worker/MD.

The schema represents all four custom-MD decisions with raw MD 1, countable MD 0, historical labor 270000, and countable labor 0. It also represents S098 OTHER with preserved historical labor, zero countable labor, and overhead scope; and S107 HOLIDAY with zero labor/countable labor and none scope. The ten known duplicate rows remain safe because source idempotency uses distinct fingerprints rather than a business-tuple constraint.

Two indexes support source identity. A non-unique active-row lookup covers `(source_namespace, source_row_key)`. A partial unique index covers `(source_namespace, source_fingerprint)` only when the row is active and both source identity values are present. Existing rows may therefore retain null source identity until a separately authorized backfill.

## Future gated order

1. Schema apply.
2. Schema verification, including unchanged count and UUID set.
3. Immutable-resolution backfill dry-run.
4. Separately authorized backfill.
5. Ledger, duplicate, atomic-group, and identity validation.
6. Constraint and index strengthening after validation.
7. Separately authorized worklog migration.
8. Post-migration validation.

The existing RLS and role behavior are unchanged. Future V2 financial/read models may use `countable_md`, `labor_amount`, `countable_labor_amount`, and `cost_scope`; no application code is changed in this phase.
