# V2 Deterministic Data Generation Plan

This is an architecture plan only. Phase 0 did not implement or run a generator.

## Pipeline

`data-input/source_cashbook.xlsx` → deterministic parser/normalizer → validation model → one coordinated write of canonical CSVs, trace/review files, manifest, README, and `INOPNC_Master_v2.xlsx`.

The generator should use the existing locked Node dependencies (`xlsx`, `papaparse`, built-in `crypto`) without installing packages. Python 3.14 is available, but no suitable spreadsheet package was verified; Node is therefore the preferred reproducible runtime.

## Input contract

The input is copied—not moved—from a user-selected original only after SHA256 confirmation. The generator records source path metadata, byte size, modified time, SHA256, workbook sheet names, and the exact generator/version hash. It never edits the workbook.

Every source row receives a stable fingerprint derived from normalized sheet identity, source row number, and losslessly serialized source cell values. Original values remain available through `source_trace.csv` and the verification workbook.

## Coordinated outputs

`data-generated/` will contain:

- `manifest.json`
- `sites_canonical.csv`
- `worklogs_canonical.csv`
- `expenses_canonical.csv`
- `review_required.csv`
- `source_trace.csv`
- `README.txt`
- `INOPNC_Master_v2.xlsx`

All outputs must come from the same in-memory validated dataset in one run. Hand-editing a CSV or workbook independently is prohibited. The manifest records row counts, totals, ranges, category totals, review counts, source/output hashes, generator version, and business-rule version.

## Required business rules

- Preserve every source row/value and trace it by fingerprint.
- Model Yeosu operational customer `삼표피앤씨` separately from invoice/source legal names (삼표피앤씨, 건성, 성보산업개발, 이건테크 variants).
- S067 is the base Yeosu underground-parking/PC repair and its non-independent extensions.
- S068 is only the independent `내민발코니 철판 확공 보수` job and directly dependent labor/costs.
- Never infer S068 from location alone.
- Reassign related expenses only with worker, time/date, chronology, description, card, and source-note evidence; otherwise emit `REVIEW_REQUIRED`.
- Treat source `sites.budget` as future `contract_supply_amount`, never as `cost_budget_amount`; unknown true cost budgets remain null.
- Preserve historical `daily_rate_snapshot` and `labor_amount`; never recalculate history from current worker daily.
- 휴무: `countable_md=0`, labor 0. 기타: `countable_md=0`, while preserving supported historical overhead labor.
- Never delete duplicates automatically when note/source evidence differs.
- Never auto-confirm fuzzy identity matches.

## Validation gates

Before publishing local outputs, the generator must prove:

1. Source row accounting is exact and each row has one trace record.
2. Canonical keys and fingerprints are deterministic across repeated runs.
3. Raw versus countable MD and labor totals reconcile explicitly.
4. Expense row and amount totals reconcile to source evidence.
5. Duplicate candidates remain represented and reviewable.
6. S067 and S068 remain separate codes.
7. Legal/source customer names survive operational grouping.
8. Blank/invalid dates are preserved in review output rather than silently dropped.
9. A second run over the same SHA256 produces byte-identical normalized outputs (allowing only explicitly excluded timestamp fields).

## Phase boundary

The next phase cannot start until one source workbook is found or selected, copied to `data-input/source_cashbook.xlsx`, and verified by matching SHA256. This plan authorizes no database write, schema change, reconciliation, or deployment.
