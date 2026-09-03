# Phase 5.2 Worklog Decisions Final

## Scope and immutability

This phase records user-approved decision states only. The immutable source `phase5-user-decisions.json` retained SHA-256 `c49b9e0c7cbdff5b171770d88b82668d9710de227d108b7a6917b86341f41ec1`. No Production query or mutation, SQL generation, migration, application change, expense reconciliation, deployment, commit, or push occurred.

## Recorded decisions

All 779 decision rows now have a decision: 61 business-site corrections use the Canonical site, 13 approved legacy-component events target the primary UUID for a future consolidation, and the single worker correction uses the Canonical worker. S067 remains basic PC repair and S068 remains the independent balcony steel-plate job; this decision set never merges them.

Fourteen of 19 MD corrections are approved and five require source-trace review. Four of 99 multi-field corrections are approved; the remaining 95 require review. Of 62 true-missing candidates, 53 are approved as future dry-run insert candidates and nine paired split rows remain atomic review items. These states do not authorize current inserts or updates.

## Memo policy

Ten Canonical-richer memos and 32 specifically approved business-difference memos use the Canonical operational memo while preserving the prior Production memo in audit/source history. Thirteen richer Production memos remain unchanged. The remaining 238 memo items require source review.

## Identity and retention

All unresolved identities remain DEFER_IDENTITY, including the nine Phase 4/5 deferred sites. All 102 Production-only rows remain KEEP_PRODUCTION_ONLY and are not deletion candidates. Four post-canonical rows and all ten known-valid duplicate rows remain protected.

## Raw/countable MD guard

P5D-0164, P5D-0165, P5D-0168, and P5D-0169 explicitly record `raw_md = 1`, `countable_md = 0`, and `V2_SEMANTIC_ONLY_NO_LEGACY_MD_WRITE`. A future schema must preserve both meanings; the single legacy Production `md` field must not be overwritten to emulate them.

## Next gate

The source-trace queue contains only REVIEW_REQUIRED and DEFER_IDENTITY decisions, ordered by MD semantic conflict, paired split, multi-field correction, memo/site conflict, deferred identity, and remaining memo review. Phase 5.3 source-trace review is required before any write plan. Phase 6 has not started.
