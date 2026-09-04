# Phase E2 — Minimal additive expense schema

Status: PASS — draft and static validation only. Target project reference is `drferwbxvlsvcxcadyos`; no remote connection, SQL execution, migration apply, or canonical import was performed.

## Fixed model

`transactions` is source evidence, `expense_allocations` is assignment history, and the security-invoker read models are calculation inputs. Existing transaction UUIDs and source values remain unchanged. `transactions.site_id` remains a compatibility fallback only.

The transaction additions are `source_type`, `source_namespace`, `source_row_key`, `source_fingerprint`, `is_active`, `voided_at`, `void_reason`, `supersedes_transaction_id`, and `updated_at`. Existing `created_at` is reused. The draft uses `IF NOT EXISTS` for columns and the apply review must confirm constraint names before execution.

## Identity and import

Source identity is `(source_namespace, source_row_key)`. Its partial unique index applies only when both values are present, allowing manual transactions to omit source keys. `source_fingerprint` supports content validation and drift detection and is deliberately not unique. No constraint uses date, description, and amount.

A repeated canonical import with the same deterministic source namespace and row keys therefore inserts zero rows. Different source row keys remain distinct even when their business tuple or fingerprint is identical. The verified canonical baseline is 4,885 rows and 216,525,934 total across exactly nine categories.

## Allocation and calculation

Allocation rows contain no copied source evidence. Multiple active rows may split one transaction across site UUIDs, including independent S067 and S068 allocations. A transaction-row-locking trigger serializes allocation changes and rejects an active total above the transaction amount; this cannot be expressed safely as a row CHECK.

The financial read model uses active, non-voided allocations when any allocation history exists. Only transactions with no allocation rows use legacy `transactions.site_id`. An active unallocated source remains in the company source view but is absent from site profit until reviewed and allocated.

VOID changes active state and records timestamp/reason; it never hard-deletes history. Restore must be a controlled transactional command that rechecks source identity conflicts and allocation totals. Evidence correction creates a superseding transaction; site/category reassignment creates or supersedes allocations without overwriting the source transaction.

The legacy fallback may end only after every active legacy transaction has reviewed allocation coverage, source/read-model totals match, and every application/report/export reads the allocation model.

## Apply review order

1. Confirm current column and constraint inventory.
2. Add transaction columns.
3. Create `expense_allocations`.
4. Add and validate safe constraints and indexes.
5. Add the partial source-identity unique index.
6. Install and concurrency-test the allocation guard.
7. Create security-invoker read models.
8. Review grants/RLS policies separately; E2 intentionally invents none.
9. Validate schema and shadow totals.
10. Run canonical import dry-run, then seek separate approval for actual import.

The SQL draft is not in the migration deployment directory and must not be applied directly.
