# Schema Validation Gates

| Stage | PASS | BLOCKED |
|---|---|---|
| M0 preflight | Expected six tables/columns; archived counts, UUID sets, totals, constraints, indexes, RLS, triggers | Missing/extra conflicting object, unreadable catalog, unresolved baseline |
| M1 additive | Six legacy row counts and UUID sets identical; new columns NULL; new tables empty; no legacy value changed | Any row/UUID/value drift or nonempty new table |
| M2 constraints | No duplicate site code/fingerprint; FK orphan report zero for populated shadows; only planned indexes | Collision, orphan, lock/runtime risk outside window |
| M3 sites/customers | Every site code reviewed; aliases preserve evidence; cost budget not inferred; protected pairs distinct | Name-only merge, alias ambiguity without review, fabricated budget |
| M3 work logs | Cutoff/provenance complete; historical labor reconciles; post-cutoff preservation set untouched | Invalid date/ref, unexplained labor, overwrite risk |
| M3 transactions/allocations | Scoped fingerprints stable; replay inserts zero; source/allocation sums valid; refunds resolved | Global fingerprint collision, allocation overflow, destructive reimport |
| M3 checklist | Invoice and settlement independently classified; legacy status/raw text preserved | Ambiguous record automatically coerced |
| M4 view | PostgreSQL security-invoker capability verified; site/company parity; zero/NULL tests; no double count | RLS bypass, parity drift, fallback double count |
| M5 RLS | All five role suites pass; UPDATE has read and write checks; production_manager sees NPC-1000 only; NPC-3000Q admin-only | Any cross-scope read/write or legacy client outage |
| M6 deprecation | No legacy reader/writer during rollback window; audit and recovery verified | Any active dependency or incomplete parity |

Universal invariants are zero existing-row deletion, zero UUID regeneration, no Production write from canonical, and no hard-delete cascade. `RESTRICT` is standard for business parents; `SET NULL` is limited to optional provenance/link references. Every failed gate stops the sequence and requires a new reviewed forward draft.
