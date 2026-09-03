# Canonical V2 Validation

Dataset: `2026-09-03.v2`  
Generator: `1.0.0`  
Status: `PASS`

## Source accounting

| Invariant | Actual | Result |
|---|---:|---|
| Source rows | 2,881 | PASS |
| Source trace rows | 2,881 | PASS |
| Source fingerprint duplicates | 0 | PASS |
| Exact meaningful source duplicates | 0 | PASS |
| Source date range | 2024-11-01–2026-09-02 | PASS |
| WORKLOG_AND_EXPENSE | 1,333 | PASS |
| WORKLOG_ONLY | 1,005 | PASS |
| EXPENSE_ONLY | 542 | PASS |
| EXCLUDED_CANCELLED | 1 | PASS |

## Sites

| Invariant | Actual | Result |
|---|---:|---|
| Canonical sites | 138 | PASS |
| Contract-amount-known sites | 121 | PASS |
| Zero/unknown legacy amount sites | 17 | PASS |

The exact zero/unknown list is S071, S081, S096, S098, S107, S112, S119, S128, S149, S150, S164, S165, S166, S168, S169, S171, and S173. `cost_budget_amount` was not filled with zero or contract amounts.

## Worklogs

| Invariant | Actual | Result |
|---|---:|---|
| Rows | 2,338 | PASS |
| Date range | 2025-01-01–2026-08-31 | PASS |
| Raw MD | 2,281 | PASS |
| Countable MD | 2,200 | PASS |
| Labor | 663,620,000 | PASS |
| Countable labor | 630,005,000 | PASS |
| Other overhead labor | 33,615,000 | PASS |
| Holiday countable MD | 0 | PASS |
| Other countable MD | 0 | PASS |
| Unresolved labor rows | 3 | PASS |
| Preserved duplicate candidate groups | 5 | PASS |

All ten rows belonging to the five specified duplicate-candidate pairs remain present with distinct provenance/notes.

## Expenses

| Category | Total |
|---|---:|
| 아침 | 12,022,049 |
| 점심 | 15,362,712 |
| 저녁 | 16,067,392 |
| 간식 | 10,364,251 |
| 자재 | 19,694,919 |
| 주유 | 36,819,633 |
| 숙박 | 29,069,668 |
| 장비 | 57,485,000 |
| 기타 | 19,640,310 |

Expense rows: 4,885. Expense total: 216,525,934. Category totals sum exactly to the expense total.

## Financial reconciliation

| Value | Amount |
|---|---:|
| Labor | 663,620,000 |
| Expenses | 216,525,934 |
| Direct cost | 880,145,934 |

`labor + expenses = direct cost` passed exactly.

## Yeosu validation

| Value | S067 | S068 |
|---|---:|---:|
| Contract supply amount | 39,989,000 | 17,030,000 |
| Actual total cost | 20,730,855 | 9,837,520 |
| Expected profit | 19,258,145 | 7,192,480 |
| Cost ratio | 51.8414% | 57.7658% |

Reallocated S068 → S067: labor 540,000; expenses 259,005; total 799,005. Combined S067+S068 cost remains 30,568,375, so total cost is preserved.

## Review and change records

`review_required.csv` contains 128 evidence-level review rows, including unresolved labor, duplicate candidates, the preserved cancellation, and source mapping flags. Decisions remain unfilled. `generator_changes.csv` records every generator-applied business mapping, including site-code corrections and operational-customer standardization, while preserving original values.

## Determinism and quality

- Two-run meaningful determinism: PASS
- New generator lint errors: 0
- Generator internal validation: PASS
- Production database changed: NO
- Production reconciliation: NOT_STARTED
- Vercel deployed: NO
- Git pushed: NO

This dataset is ready for domain model design, not production apply.
