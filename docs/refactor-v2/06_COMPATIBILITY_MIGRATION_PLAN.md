# Compatibility Migration Plan

## Objective

Move from the current six-table schema to Domain Model V2 without changing existing UUIDs, deleting operational evidence, breaking current reads, or making canonical files a runtime overwrite source. This document defines sequencing and gates only; it contains no executable SQL.

## Observed compatibility risks

- Production has no FK constraints.
- Work-log site/worker and transaction site references are TEXT despite UUID target rows.
- Site normalized name is unique, conflicting with valid same-name contracts.
- Work-log and transaction tuple uniqueness rejects legitimate events while failing robust import idempotency.
- `sites.budget` means contract supply, while code labels and calculations can imply budget.
- Labor is currently calculated from mutable `workers.daily` with `daily || 150000` fallback.
- Whole-state synchronization upserts lists and hard-deletes missing rows.
- Edge imports can delete all existing rows and use fuzzy name matching/fragile tuple deduplication.
- RLS policies permit broad public or anon/authenticated CRUD and there is no role/site membership schema.

## Staged sequence

### Stage 0 — Freeze semantics and capture parity

Record Production row counts, UUID sets, orphan references, protected site pairs, current per-site/company totals, applied migration versions, and import fingerprints. Define NPC-1000/NPC-3000Q ownership mappings. No writes occur in this design phase.

Gate: every current UUID is accounted for and S067/S068 baseline totals are separate.

### Stage 1 — Additive foundations

In a future migration draft, add only nullable/shadow semantic columns plus `customer_aliases`, `expense_allocations`, `import_batches`, `financial_obligations`, `audit_logs`, and authorization membership structures. Preserve legacy columns and indexes initially. New references use UUID while existing TEXT remains untouched.

Gate: schema additions do not change existing reads or row counts.

### Stage 2 — Deterministic backfill

Backfill site codes, contract supply shadow values, operational customers, aliases, parsed dates, UUID references, work-log entry/labor semantics, transaction source semantics, and one legacy allocation per valid legacy `site_id`. Unknown, ambiguous, or invalid records enter review state rather than receiving guessed values. Cost budget stays NULL without evidence.

Gate: zero unexplained UUID changes; zero unreviewed orphan references; protected pairs remain distinct; source totals reconcile.

### Stage 3 — Dual read/write

Write both compatible legacy fields and V2 fields for a bounded period. Read V2 when complete and fall back explicitly—not by truthiness—to legacy values only when the shadow field is NULL. Emit parity metrics and reject commands that cannot preserve source/assignment separation. Disable destructive full-table import paths before allowing V2 imports.

Gate: per-row and per-site parity for two representative operational cycles; replay import inserts zero duplicate sources.

### Stage 4 — Constraints and authorization

After orphan/collision validation, establish UUID FKs, positive allocation rules, scoped fingerprint uniqueness, site-code uniqueness, controlled states, and role/site RLS. Cross-row allocation totals need a transactional database command/locking boundary because a row CHECK alone cannot validate the sum. Replace broad public policies only after authenticated clients and membership coverage are proven.

Gate: authorization tests for all five roles; production_manager cannot read NPC-3000Q; worker cannot cross site/identity; admin retains recovery access.

### Stage 5 — Read-model cutover

Create the security-invoker summary view in the future schema phase. Compare its site and company totals with the canonical/baseline calculation, including overhead and unallocated buckets. Move Home, Expense, calendar summaries, Excel, and PDF consumers to the same contract.

Gate: exact or explained rounding parity, NULL/zero tests, S067/S068 independent results, and no exporter-local profit formula.

### Stage 6 — Deprecation

After sustained parity, stop legacy writes, then remove name/tuple uniqueness and eventually retire `budget`, TEXT references, transaction `site_id`, and obsolete checklist financial interpretations. Do not remove columns, constraints, or tables in the same release that switches reads.

Gate: rollback window elapsed, audit trail complete, and no active client uses legacy fields.

## UUID and FK transition

Use shadow UUID columns, deterministic backfill, orphan reporting, dual read/write, validated constraints, read switch, and only then legacy retirement. Never cast/replace existing UUID primary keys. Blank TEXT references become NULL/review—not fabricated UUIDs. Every mapping stores basis and reason.

## Constraint design (future, no SQL here)

- Unique: `sites.site_code`; source fingerprint within source/provider scope; file SHA with parser/version semantics as appropriate.
- Not unique: site name; `(date, site, worker, md)`; `(date, description, amount)`.
- FK: aliases→customers, sites→customers, work logs→sites/workers/batches, transactions→workers/batches, allocations→transactions/sites/work logs, obligations→customers/sites.
- Row checks: nonnegative MD/rates/source amount; active allocation amount positive; state-consistent holiday/other values.
- Cross-row command invariant: locked active allocation sum ≤ transaction amount, with equality for FULL.
- Lifecycle: superseded references cannot self-reference; active/void state transitions are audited.

## Import cutover

The V2 importer stages files without touching current rows, computes file and row fingerprints, previews exact duplicates and mapping recommendations, and waits for confirmation. It appends source transactions and assignments in one controlled command. Existing `clearExisting`, delete-all work-log import, fuzzy site assignment, and tuple-only dedup paths are retired after parity, never used for V2 canonical application.

## Rollback strategy

Before legacy retirement, rollback means switching reads/writes back to preserved legacy fields while retaining additive V2 data for diagnosis. No rollback regenerates UUIDs or restores from canonical by overwriting Production. After constraint/RLS cutover, rollback is a reviewed forward migration that restores compatibility policy/read behavior; audit and source evidence remain intact.

## Read-only Production snapshot used

Six public tables were observed with row counts: sites 155, workers 34, work_logs 2260, transactions 3324, checklists 15, customers 48. All have UUID PKs and RLS enabled; no FKs exist. Applied migration history contains 11 entries through `20260218232000_add_checklist_material_fields`. The catalog showed only primary-key, three normalized-name, and two business-tuple unique indexes. This snapshot is evidence for design, not a migration authorization.

## Next-phase entry criteria

The schema migration draft may begin only after these artifacts are reviewed, identity mappings and role memberships are supplied, historical labor backfill evidence is accepted, and the intended allocation transaction boundary is approved. The next phase drafts SQL for review; it must not apply it to Production without separate authorization.

## Design-phase verification

- `npm test`: PASS — 2 test files, 4 tests.
- `npm run build`: PASS — production bundle and PWA assets generated; existing chunk-size and stale Browserslist-data warnings only.
- New analysis script/code lint errors: 0 — this phase added no executable analysis or application code.
- Repository full-lint baseline recorded from the phase contract: 59 errors / 7 warnings. No autofix was run. A confirmation run was stopped after it produced no result for several minutes; it is not used as a Phase 2 pass gate because application code was unchanged.
