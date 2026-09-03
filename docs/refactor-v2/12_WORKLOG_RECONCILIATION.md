# Phase 5 Worklog Reconciliation

## Scope and safety

This phase performed a read-only, row-level comparison between Canonical dataset `2026-09-03.v2` and the current Production `work_logs` table. The script uses the publishable Supabase client, exact-count pagination, and `select` reads only. It contains no database mutation, DDL, migration, application-code change, or expense reconciliation.

The authoritative identity input is `phase4-identity-resolution-map.json`. Phase 4 `EXACT` and `AUTO_SAFE_LINK` crosswalk rows supply previously established non-review identity links; approved Phase 4.2 links override them. Display-name equality is never used to assign a Production UUID. S067 and S068 additionally accept their approved legacy-component UUIDs as candidates while retaining their distinct primary UUIDs.

## Verified inputs and Production snapshot

- Canonical version: `2026-09-03.v2`
- Source SHA-256: `38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327`
- Canonical rows: 2,338
- Production rows at read time: 2,260
- Production rows through 2026-08-31: 2,256
- Post-canonical rows from 2026-09-01: 4
- Unexpected Production row loss relative to Phase 4: none

All 2,338 Canonical rows and all 2,256 pre-cutoff Production rows are accounted exactly once. The four post-canonical UUIDs are recorded separately and preserved unconditionally.

## Matching hierarchy

The implementation claims at most one unclaimed Production row per Canonical row. It first requires date, approved site UUID/component, approved worker UUID, raw MD, and normalized memo for `EXACT_MATCH`. A unique identical business tuple with strong memo-token agreement may be `SAFE_MATCH`. Unique same-event candidates with one differing field become a field-specific correction; candidates with several differing fields remain low-confidence multi-field corrections. Multiple candidates are not claimed and are marked for cardinality review. Missing Phase 4 identity resolution yields `UNRESOLVED_IDENTITY`; absence of a candidate under resolved identities yields `CANONICAL_ONLY`.

The tuple `date + worker + site + md` is only a candidate index, never a unique identity. Memo normalization is candidate evidence, not an independent proof. Production has no stored entry-type field, so Phase 5 cannot independently produce an entry-type correction from Production evidence; no such correction was inferred.

## Results

Canonical classifications are: 1,549 exact, 125 safe, 61 site corrections, 1 worker correction, 19 MD corrections, 293 memo corrections, 0 entry-type corrections, 99 multi-field corrections, 70 canonical-only, 13 review-required, and 108 unresolved identity rows.

Of the pre-cutoff Production rows, 2,147 are uniquely claimed by matches/corrections, 7 remain unclaimed because they participate in ambiguity review, and 102 are Production-only. `PRODUCTION_ONLY` is a retention classification, not a deletion recommendation. Every correction output recommends user review only and contains no SQL.

## Special-entry and amount invariants

- Raw MD: 2,281; countable MD: 2,200.
- Historical labor: 663,620,000; countable labor: 630,005,000.
- S098 OTHER overhead labor: 33,615,000.
- S107 HOLIDAY: 147 rows, all countable MD zero.
- S098 OTHER: 84 rows, raw MD 81, countable MD and countable labor zero.
- Company-wide amount change caused by this classification: zero.

Current `workers.daily` was not used to recalculate historical labor. Null and zero values remain distinct.

## Duplicate preservation

All five known duplicate-looking groups and all ten source-supported Canonical rows remain in the crosswalk. They were neither collapsed nor proposed for deletion. Where cardinality is insufficient, the row remains canonical-only or review-required rather than sharing a Production UUID silently.

## Yeosu findings

S067 remains base PC-member repair and S068 remains the independent projecting-balcony steel cutting/expansion work. S068 has 30 exact matches. S067 has 18 exact and 13 safe matches, with remaining rows retained as correction/canonical-only evidence. The 2026-08-29 송용호 `균열보수` and 2026-08-31 `잭자리 미비구간 노출마감` rows both resolve exactly to S067 through its approved legacy component and target the S067 primary UUID. No option merges S067 with S068.

## Deferred Y1 and other identity evidence

All nine deferred sites (S111, S130, S150, S151, S152, S153, S154, S155, S168) were re-aggregated by Canonical chronology, worker distribution, and memo themes against each recorded Production candidate. Similar physical-site names and overlapping activity do not distinguish the monthly/night-work contracts safely. The package therefore records `STILL_DEFER` for all nine, with candidate-level evidence; it does not rewrite the Phase 4 resolution map.

The three 임지만/S093 rows remain unresolved without a guessed Production worker UUID or daily rate and are explicitly included in the review package.

## Outputs and next gate

The crosswalk, Production-only/post-canonical ledger, correction package, user-review package, deferred-identity evidence, and machine-readable summary are under `artifacts/refactor-v2`. `user_decision` remains blank wherever present.

The next permitted step is user review of correction, cardinality, unresolved-identity, and Production-only retention classifications. Expense reconciliation, mutation SQL, migration apply, and Production worklog changes remain outside this phase.
