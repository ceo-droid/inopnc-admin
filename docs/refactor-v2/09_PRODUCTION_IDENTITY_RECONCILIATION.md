# Production Identity Reconciliation

## Scope and current state

This phase performed SELECT-only identity reconciliation. Canonical inputs were limited to the six `data-generated` files. The manifest is `2026-09-03.v2`, source SHA-256 is `38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327`, and all declared CSV hashes and counts passed.

Current Production counts are customers 48, sites 155, workers 34, work logs 2,260, transactions 3,324, and checklists 15. These equal the latest recorded Phase 2 database snapshot, so there is no evidence of unexplained row loss. Work logs range from 2025-01-01 to 2026-09-03; four rows dated 2026-09-01 through 2026-09-03 are POST_CANONICAL and must never be overwritten. Transactions range from 2025-01-01 to 2026-01-29. No work-log row or transaction was reconciled individually.

## Method

Original labels are preserved. Normalization removes spacing, punctuation, and corporate notation only to find candidates. EXACT requires normalized identity plus corroborating context. AUTO_SAFE_LINK requires a single candidate supported by customer, contract amount, and name/business context; similarity alone cannot qualify. Ambiguity becomes REVIEW_REQUIRED. Canonical-only and Production-only identities are preserved without inserts or deletion recommendations.

## Site results

All 138 canonical sites are accounted exactly once: EXACT 39, AUTO_SAFE_LINK 66, CANONICAL_ONLY 6, DUPLICATE_NAME_SEPARATE_CONTRACT 13, and REVIEW_REQUIRED 14. The crosswalk also records 32 unclaimed Production-only rows. There are zero automatic duplicate UUID claims.

Protected same-name groups are not merged. 송도 S017/S091 and 대전도안 S064/S147 have distinct Production UUID candidates but remain in the user-review package because contract identity is more important than label similarity. The same treatment applies to 대조, 아산, 용인 FAB, and 인천검단 protected groups.

### Yeosu

The business rule is final: S067 is regular PC-member repair and S068 is the independent projecting-balcony steel cutting/drilling scope. They have distinct Production UUID candidates. S067's leading candidate has a zero legacy budget and multiple related historical Production rows; S068 has multiple balcony-related candidates, including exact-amount versus stronger-name evidence. Therefore their business meanings are separate and fixed, while the UUID selections remain user decisions. No Yeosu source or customer row was merged.

Canonical contract values were compared with legacy `sites.budget` as evidence only. EXACT_AMOUNT, DIFFERENT_AMOUNT, CANONICAL_NULL, and PRODUCTION_NULL_OR_ZERO are recorded per row. The known zero/unknown site-code set is not estimated or filled.

## Customer results

Canonical operational customers total 34. Results are EXACT 30, AUTO_SAFE_ALIAS 2, and CANONICAL_ONLY 2. Production additionally has 15 ordinary Production-only rows and two INVALID_LOOKING_VALUE rows: `확인중` and `NPC-1000 10말남음`. Both are preserved and placed in the review package.

Corporate-form normalization is candidate evidence. The approved Yeosu operational grouping can represent 삼표피앤씨 as the operational identity while retaining legal/source names as aliases, but it is not applied globally to unrelated contracts and no Production UUID is merged.

## Worker results

Canonical worker labels total 34: EXACT 31, CANONICAL_ONLY 1, and REVIEW_REQUIRED 2. Production-only output has three rows. `임지만` is CANONICAL_ONLY and no worker is created. `외국인(필립)` is REVIEW_REQUIRED because Production also contains `필립`; they are not assumed to be one person. `1톤스카이` is REVIEW_REQUIRED because equipment-looking labels must not become person identities automatically. Production daily values are preserved literally, including 김혜영's zero rate.

## Manual review and safety

The consolidated review package contains 31 rows with blank `user_decision` and `user_note`. Recommended decisions are advisory only. There are no blocking duplicate automatic UUID claims, but the manual identity decisions must be completed before identity backfill or work-log reconciliation.

## Next-phase entry conditions

1. Review every site/customer/worker row in `phase4-identity-review.csv`, especially protected contract groups and Yeosu UUID selection.
2. Confirm or revise recommended links without changing Production.
3. Re-run duplicate-claim and 138/138 accounting checks using the decisions.
4. Freeze the four POST_CANONICAL work-log IDs as a preservation set in the later dry run.

Until those gates pass, the next step is user identity decisions—not work-log or expense reconciliation.
