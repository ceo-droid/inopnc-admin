# Schema Migration Draft

## Verified starting point

Production was re-read through catalog SELECT queries. It is PostgreSQL 17.6 with six public tables, no public views, no triggers, and no FKs. All six tables have UUID PKs and RLS enabled. Work-log references and transaction site references are TEXT. Current normalized-name and tuple-based unique indexes remain in place. Eleven migrations are applied through `20260218232000_add_checklist_material_fields`; repository migration files were re-read and are unchanged.

## Current → target

M1 adds nullable semantic/shadow columns to `sites`, `work_logs`, `transactions`, and `checklists`, while preserving every existing field. It adds empty `customer_aliases`, `expense_allocations`, `import_batches`, `audit_logs`, `app_user_roles`, and `site_access` tables. Existing UUIDs are untouched; only new entities receive generated UUIDs. `budget` remains the legacy contract amount and cost budget remains NULL pending evidence.

The work-log `site_uuid`/`worker_uuid` names intentionally distinguish shadow UUID references from current TEXT fields. Checklist uses `site_uuid` for the same reason. No name or tuple uniqueness is removed in this phase.

## Order and dependencies

1. M0 archives preflight catalog, counts, UUID sets, totals, and orphan results.
2. M1 adds columns/tables and enables RLS on new exposed tables, without client grants/policies.
3. M2 adds minimal indexes and constraints. Existing-row checks/FKs use NOT VALID where supported.
4. M3 is a separately approved, cutoff-aware data reconciliation—not executable in this draft.
5. M4 creates the financial view only after labor/allocation completeness gates pass.
6. M5 introduces scoped policies in shadow, tests all roles, switches authenticated clients, then removes permissive policies in a later approved migration.
7. M6 retires legacy fields/indexes only after a sustained rollback window.

## Allocation enforcement and refunds

Active allocation amounts are positive. Refunds/cancellations are modeled as correction-linked transaction source events rather than negative allocations. Any current negative transaction blocks M3 until reconciled. One narrow deferred constraint trigger locks the source transaction and validates the active sum; this is preferred over application-only validation because concurrent writers could oversubscribe, and it avoids triggers that mutate totals/status. UNALLOCATED/PARTIAL/FULL/REVIEW_REQUIRED is derived rather than duplicated across tables.

## Double-count prevention

The view uses per-transaction precedence: if any active V2 allocation exists, only active valid allocation amounts count; legacy `transactions.site_id` is ignored for that transaction. If none exists, a valid legacy site mapping is the fallback. Partial allocations therefore count only the explicitly allocated portion and leave the remainder visibly unallocated. This is safer than adding both paths or switching all rows globally.

Labor includes only active `cost_scope='SITE'` stored labor. M4 is blocked until historical rows have complete labor semantics. OTHER overhead and HOLIDAY are excluded from site direct labor. NULL/zero contracts produce NULL ratios; NULL cost budgets produce NULL remaining amounts.

## Idempotency and indexes

Draft DDL avoids `IF NOT EXISTS`: object collisions are preflight blockers, not silent success. Site codes use a partial unique index while nullable. Source fingerprints are unique only inside `(source_namespace, source_type)` and active lifecycle scope. Import file SHA is not globally unique, allowing retries/revalidation; batch metadata plus parser version identify attempts. Indexes are limited to planned date/site/worker/import/allocation/checklist query paths.

## Backfill and post-canonical protection

Order is contract semantics → reviewed site codes → customer aliases → work-log snapshots/labor → transaction evidence/fingerprints → allocations → checklist business states. Each step requires source, precondition, validation, rollback tag, and blocking conditions. Canonical work logs end 2026-08-31 and the source workbook ends 2026-09-02. Rows created or modified in Production after the applicable cutoff form a preservation set and are never overwritten. Ambiguity is REVIEW_REQUIRED, never name-fuzzy assignment.

## Security compatibility

PostgreSQL 17.6 supports `WITH (security_invoker=true)`, so the view respects underlying RLS. New tables are RLS-enabled but unavailable to normal clients until explicit grants and scoped policies are approved. Role predicates depend on server-managed role/site membership. Production manager is constrained to NPC-1000; NPC-3000Q is admin-only. Existing permissive policies cannot be removed until authenticated-client and access-coverage tests pass.

## Stop/rollback conditions

Stop on unexpected object collision, row/UUID drift, orphan, protected-site merge, fingerprint collision, negative/refund ambiguity, allocation overflow, post-cutoff conflict, view parity difference, or failed RLS isolation. Rollback before deprecation switches reads/writes to preserved legacy columns; it never restores by deleting/reimporting or changing UUIDs.

