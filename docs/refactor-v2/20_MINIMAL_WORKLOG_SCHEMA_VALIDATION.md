# Phase 5.8 Minimal Worklog Schema Validation

Status: **PASS**. Validation was static and read-only. The Phase 5.7 SQL draft remained unchanged, no Production connection was used, and no migration or worklog data operation was performed.

## Static result

Draft SHA-256: `fb49be217aebd73e5b8abc6bac8af929020ecd99f357b3633ca96cf25b6b4bb2`.

The draft adds exactly the expected eleven columns, including `countable_labor_amount`, with no duplicate or extra column. Both MD columns use `numeric(8,2)`, so fractional MD is representable. Both labor columns use `bigint`. All eleven columns are nullable, have no default, and do not populate the existing 2260 rows.

The four named constraints contain all six required numeric rules and accept the initial null state. They reject negative raw/countable MD, countable MD above raw MD, negative labor, and countable labor above labor. The text checks accept the required NORMAL/OTHER/HOLIDAY and direct/overhead/none vocabularies without adding enum objects.

The active source-managed unique index is scoped to `(source_namespace, source_fingerprint)` only when `is_active` is true and both identity values are present. Existing null fingerprints remain permitted. It is neither a global fingerprint-only constraint nor a date/site/worker/MD uniqueness rule, so the ten known valid duplicate rows remain safe. The second index is narrowly scoped to active `(source_namespace, source_row_key)` lookups needed for migration traceability and operational source-row lookup.

## Representability and guards

The custom-MD example, S098 OTHER, and S107 HOLIDAY all satisfy the drafted types and constraints. All five required invalid examples are rejected logically. The five insert conflicts remain untouched and receive no automatic insert, merge, conflict update, deletion, or UUID rewrite. The 116 deferred rows are untouched. S067 and S068 receive no identity transformation.

The dangerous-SQL scan found zero destructive operations, existing-row rewrites, table creations, worklog inserts, or conflict-update clauses. Legacy `id`, `date`, `site_id`, `worker_id`, `md`, and `note` are not altered. Existing migration files, including `20260218120000_harden_bidirectional_dedup_constraints.sql`, were not changed.

## Idempotency and shadow validation

Classification: **IDEMPOTENT** for serial controlled execution. Columns and indexes use `IF NOT EXISTS`; constraints use relation-scoped catalog guards. A controlled apply should still verify that any pre-existing object with the same name has the expected definition.

Shadow validation was `SKIPPED_NO_SAFE_LOCAL_DB`: no local `psql` executable or explicitly configured safe local PostgreSQL database was available, and Production access was prohibited. The draft uses established PostgreSQL syntax and is statically compatible; no Production version lookup was performed.

Apply recommendation: **READY_FOR_CONTROLLED_SCHEMA_APPLY**. This recommendation authorizes planning only; it does not apply the draft or create a migration file.
