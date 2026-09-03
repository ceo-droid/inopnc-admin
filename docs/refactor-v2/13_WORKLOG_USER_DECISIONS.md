# Phase 5.1R Worklog User Decisions

## Output mode and safety

This package was generated in JSON/TXT mode because the spreadsheet artifact runtime was unavailable. Existing Phase 5 CSV files were read as ordinary UTF-8 data through the repository's existing Papa Parse dependency. No CSV, workbook, Production query, database write, migration, application change, dependency installation, or Phase 6 activity was performed.

## Decision priorities

- P0_CRITICAL contains site, worker, MD, material multi-field corrections, plus approved legacy-component UUID consolidation candidates. These may affect allocation, historical interpretation, or future identity structure.
- P1_IDENTITY contains the 108 unresolved-identity rows and 13 ambiguous review rows. They are grouped by cause rather than presented as 121 unrelated identity questions.
- P2_MISSING contains the 70 canonical-only rows. This is evidence for review, not authorization to insert.
- P3_LOW_RISK contains 293 memo-only differences grouped as format-only, Canonical-richer, business-different, or review-required.
- P4_RETENTION contains 102 Production-only rows. The default is KEEP_PRODUCTION_ONLY; none is a deletion recommendation.

## Memo grouping

The 293 memo differences are not treated as 293 equal-risk questions. Pure representation differences and cases where the Canonical memo strictly adds detail recommend USE_CANONICAL_MEMO without applying it. Rows with disjoint business wording or insufficient semantic evidence remain explicit review items. This conservative lexical grouping is recommendation evidence only.

## Site and labor interpretation

S067 and S068 remain separate business identities. A correctly recorded S067/S068 event on an approved legacy UUID is UUID_CONSOLIDATION_ONLY; it is not mislabeled as a business-site error. Actual correction candidates outside the approved primary/legacy component set remain BUSINESS_SITE_CORRECTION. Site movement has zero company labor delta. MD deltas use the Canonical historical labor-per-raw-MD snapshot when calculable; current worker daily rates are never substituted.

## Deferred identities

S111, S130, S150, S151, S152, S153, S154, S155, and S168 remain STILL_DEFER. Their month/date, worker, memo, and Production-candidate chronology is embedded in the JSON dataset. Similar Y1/CUB naming does not justify merging monthly, floor-specific, day/night, or contract-specific identities.

## Required approval before any write

Users should first decide all MD and worker changes, business-site corrections, material multi-field corrections, unresolved identities, and true-missing candidates. Memo business differences follow. Production-only retention remains the safe default. The JSON user_decision and user_note fields are blank; completing this package does not authorize a database write or migration.
