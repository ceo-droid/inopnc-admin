-- NON-EXECUTABLE BACKFILL PLAN. This file intentionally contains comments only.
-- B1 sites: source legacy budget; target contract_supply_amount. Preconditions: row/UUID snapshot and semantic approval. Validate count/sum parity. Rollback: clear only tagged shadow values. Block on post-cutoff conflict. cost_budget_amount remains null.
-- B2 site_code: source reviewed canonical-to-Production UUID mapping. Validate nonblank uniqueness and protected pairs. Rollback mapping batch only. Block on duplicate, absent UUID, or name-only inference.
-- B3 customers/aliases: source reviewed operational/legal/source names. Validate every alias target and ambiguity queue. Rollback newly tagged alias rows only. No business names embedded in schema draft.
-- B4 work logs: source canonical through 2026-08-31 plus Production preservation set. Populate work_date, UUID shadows, entry type, raw/countable MD, snapshot, labor, provenance. Never overwrite Production-created/modified post-cutoff rows. Block on invalid date/orphan/unknown labor evidence.
-- B5 transactions: source workbook through 2026-09-02 plus Production preservation set. Enrich source fields and scoped fingerprints without rewriting original evidence. Block on fingerprint collision or correction/refund ambiguity.
-- B6 allocations: create reviewed legacy-compatible assignments only after transaction enrichment. Validate per-source totals and site/company parity. Never double count; allocation presence takes precedence over legacy mapping.
-- B7 checklists: classify direction, invoice and settlement separately. Preserve legacy status and raw text. Block on ambiguous financial versus task/material meaning.
-- Every batch records cutoff, source hash, expected UUID set, actor, and validation output. No step is authorized by this draft.

