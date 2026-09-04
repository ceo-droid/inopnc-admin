# Phase 5.6 Worklog Schema Prerequisite Review

Status: **PASS — REVIEW ONLY**. This file materializes the confirmed review; it does not contain SQL and no database, migration, or application change was performed.

## Minimum additive schema

The current legacy `work_logs` columns remain `date`, `site_id`, `worker_id`, `md`, and `note`. Existing UUIDs and all legacy columns must be preserved; dropping or renaming them is prohibited.

The eleven columns required now are `entry_type`, `raw_md`, `countable_md`, `labor_amount`, `countable_labor_amount`, `labor_source`, `cost_scope`, `source_namespace`, `source_row_key`, `source_fingerprint`, and `is_active`. All begin nullable and additive. `countable_labor_amount`, omitted from the Phase 3 draft, is explicitly REQUIRED NOW. NOT NULL strengthening occurs only after verified backfill.

The required checks express nonnegative raw/countable MD and labor, `countable_md <= raw_md`, and `countable_labor_amount <= labor_amount`. Active source-managed rows use a partial unique strategy over `(source_namespace, source_fingerprint)`. A unique constraint over date, site, worker, and MD is prohibited because ten known valid duplicate rows must remain distinct.

## Semantic preservation

P5D-0001, P5D-0002, P5D-0003, and P5D-0005 each retain raw MD 1 and historical labor 270000 while countable MD and countable labor are zero. S098 OTHER preserves raw MD and historical labor, with zero countable MD/labor and overhead cost scope. S107 HOLIDAY has zero countable MD, labor, and countable labor with `cost_scope=none`.

The 116 deferred rows remain excluded. All nine atomic split groups prohibit partial application. S067 and S068 remain separate. Five insert conflicts remain `REQUIRES_USER_REVIEW`; the Phase 5.5 artifact identifies only legacy tuple proxy matches and does not retain the conflicting Production UUID, so they are not automatically equated with known duplicate groups.

## Apply order

1. Additive nullable schema.
2. Schema verification.
3. Immutable-resolution backfill dry-run.
4. Backfill under separate authorization.
5. Validation.
6. Constraint and index strengthening.
7. Worklog migration under separate authorization.
8. Post-migration validation.

Schema-supported actions remain 0 and schema-prerequisite actions remain 410.
