# User Identity Decisions

## Package scope

This package reorganizes all 31 Phase 4 review rows and adds nine explicit CANONICAL_ONLY recheck rows, for 40 rows total. The added rows are necessary because deciding whether a missing canonical identity becomes a later creation candidate cannot be inferred safely. No `user_decision` or `user_note` value is prefilled.

Categories:

- DECISION_REQUIRED: 35 — an explicit identity/creation choice is needed.
- BATCH_KEEP: 3 — high-evidence protected-contract links that can be reviewed together, but are not approved automatically.
- INVALID_FLAG: 2 — `확인중` and `NPC-1000 10말남음`; preserve and flag, never auto-delete.
- INFORMATIONAL: 0.

Recommendations use only `LINK:<production_uuid>`, `KEEP_PRODUCTION_ONLY`, `KEEP_CANONICAL_ONLY`, `INVALID_LOOKING_VALUE`, or `DEFER`. Confidence describes evidence quality, not user approval.

## Priority site decisions

| Canonical | Leading Production evidence | Recommendation | Confidence |
|---|---|---|---|
| S067 basic PC repair | `9ddbc746…` active, budget 0, 12 work logs through 2026-08-31; alternatives `7cdd5e25…` budget 33,489,000 with 18 logs/76 transactions and `3471d20e…` budget 6,500,000 with 8 logs/18 transactions | DEFER | MEDIUM |
| S068 projecting-balcony steel expansion | `819c0b09…` budget 17,030,000, 64 logs/155 transactions, themes include cutting/hole drilling; alternative `908f5f78…` has the clearest display name and budget 17,000,000 but only 2 logs/0 transactions | `LINK:819c0b09-d093-4717-a09d-86896d527845` | MEDIUM |
| S064 Daejeon underpass | `5b925522…`, 유한회사 대영, budget 2,300,000, 27 logs/10 transactions | DEFER | MEDIUM |
| S147 Daejeon underpass | `2c636eae…`, 삼일씨엔에스, budget 12,200,000, 1 log/0 transactions | `LINK:2c636eae-9796-491c-80f9-45de9ca46d6f` | MEDIUM |
| S017 Songdo Center Park | `5603ec61…`, toplight design-change scope, budget 1,800,000, 1 log | DEFER | MEDIUM |
| S091 Songdo Center Park | `d518d26a…`, budget 19,962,800, 34 logs/10 transactions | `LINK:d518d26a-3405-436a-9ea9-da20896dd8f4` | MEDIUM |

S067 and S068 are never merge alternatives. Their business meanings are fixed; only which existing UUID represents each unit is being decided. Full dates, totals, representative workers, memo themes, and alternative-candidate aggregates are retained in `phase4-user-decisions.csv`.

## Worker decision

`외국인(필립)` (`9137b6a9…`, daily 1,300,000) and `필립` (`f6490d29…`, daily 130,000) coexist. The recommendation is DEFER with LOW confidence; neither same-person nor separate-person identity is preselected. `1톤스카이` remains DECISION_REQUIRED because equipment is not automatically a worker.

## CANONICAL_ONLY recheck

Nine rows require an explicit keep/create-later decision: sites S065, S100, S118, S163, S164, S166; customers 에이치디씨현대피씨이(주) and 주식회사 대양(DAEYANG, INC); worker 임지만. Their recommendation is KEEP_CANONICAL_ONLY. This means preserve as a canonical migration candidate, not insert it now.

## Production-only retention

Production-only identities are not deletion candidates and remain preserved. The two invalid-looking customer labels are flags only. BATCH_KEEP similarly means “review together,” not “automatically write.”

## How to decide

Enter a permitted recommendation value or an explicit DEFER in `user_decision`, and put rationale in `user_note`. Review the six priority site rows first, then Philip/equipment, remaining ambiguous sites, canonical-only candidates, batch keeps, and invalid flags. After decisions are complete, rerun UUID-claim checks before any later dry run.

Phase 5 work-log reconciliation, schema application, commits, and pushes are outside this phase and have not started.
