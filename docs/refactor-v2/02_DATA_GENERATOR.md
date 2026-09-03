# V2 Deterministic Data Generator

## Scope and safety

The Phase 1 generator reads only `data-input/source_cashbook.xlsx` and writes only ignored local output under `data-generated/` plus its validation artifact. It does not connect to Supabase or Vercel, generate UUIDs, modify application code, edit migrations, reconcile production identities, or apply data.

Source SHA256 is checked before workbook parsing. The generator exits with `BLOCKED_SOURCE_HASH_CHANGED` unless it equals:

`38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327`

## Source discovery

The generator inspects workbook structure on every run and detects normalized header names rather than assuming hard-coded row positions.

| Sheet | Used range | Detected header row |
|---|---|---:|
| 현장별_실시간_요약 | A1:R142 | 4 |
| 현장별_실시간_금전출납부 | A1:Z2883 | 1 |

Required sheets and headers are validated before generation. Missing structure stops with `BLOCKED_SOURCE_SCHEMA`.

## Provenance

Every one of the 2,881 meaningful detail rows receives a SHA256 fingerprint over:

- Source workbook SHA256
- Source sheet
- Actual Excel row
- Ordered normalized header/value pairs

The user-facing `행` value is preserved as `source_original_row_label`/`source_row_key`, but it is not treated as unique identity. Every output row links back to its source fingerprint, sheet, and actual Excel row. Content-only duplicate checking is performed separately and found zero exact meaningful duplicates.

## Classification and canonicalization

Source labels representing card/invoice-only events (`WC`, `CX`, `EX`, `CA`, `C…`, `E…`, and `-CARD`) are expense-only. Remaining active rows are worklog evidence. The single cancelled row remains in source trace and review output but not active canonical rows.

Source accounting:

- WORKLOG_AND_EXPENSE: 1,333
- WORKLOG_ONLY: 1,005
- EXPENSE_ONLY: 542
- EXCLUDED_CANCELLED: 1

Each nonzero one of the nine expense columns becomes one canonical expense allocation, preserving its shared source event and provenance. This yields 4,885 allocations without inventing transaction-level timestamps; `approved_at` remains blank where the aggregate source row does not provide an unambiguous per-category timestamp.

## Worklog semantics

- `NORMAL_WORK`: raw MD remains countable and historical source labor remains site cost.
- `HOLIDAY`: raw evidence remains traceable; countable MD and labor are zero; scope is none.
- `OTHER`: raw MD and historical labor remain; countable MD/labor are zero; scope is overhead.
- `daily_rate_snapshot` is only derived as source labor ÷ source MD when both are positive. It is never taken from the current application worker rate.
- The three 임지만 rows remain unresolved with blank daily-rate snapshots and zero source labor.

## Site and customer semantics

`site_code` is canonical business identity. Duplicate display names are retained across separate codes. `contract_supply_amount` is sourced from legacy 현장예산 and means contract supply/revenue amount. `cost_budget_amount` remains blank because the source provides no independent target-cost evidence.

For S067/S068, legal/source customer names are preserved while `operational_customer_name` is standardized to 삼표피앤씨. S067 is base Yeosu PC repair; S068 remains the independent projecting-balcony steel-plate enlargement job.

## Approved Yeosu correction

The content-based rule `YEOSU_S067_BASE_REPAIR` identifies only S068 rows for 송용호 dated 2026-08-28 through 2026-08-31 that contain either approved base-repair work descriptions or card 6903 chronology evidence tied to the 8/29 and 8/31 attendance. It does not use Excel row number as its business criterion.

Results:

- Source rows affected: 6
- Worklogs moved S068 → S067: 2
- Expense allocations moved: 13
- Labor moved: 540,000
- Expenses moved: 259,005
- Direct cost reallocated: 799,005
- Company-wide direct cost change: 0

## Outputs and commands

Run generation:

`node scripts/refactor-v2/data-generator/generate-v2.mjs`

Run generator tests and two-run determinism verification:

`node scripts/refactor-v2/data-generator/tests/test-generator.mjs`

Generated files:

- `manifest.json`
- `README.txt`
- `sites_canonical.csv`
- `worklogs_canonical.csv`
- `expenses_canonical.csv`
- `review_required.csv`
- `source_trace.csv`
- `INOPNC_Master_v2.xlsx`
- `generator_validation.json`
- `generator_changes.csv`

The Master workbook contains `01_원본추적`, `02_정합성_MASTER`, `03_현장별_손익`, `04_수정이력`, `05_REVIEW_REQUIRED`, and `06_앱필드정의`.

## Determinism

The test generates two independent temporary output sets and compares hashes for all CSV files, README, meaningful manifest content, normalized Master sheet content, and meaningful validation content. Only `manifest.generated_at` is excluded. All compared hashes matched.

