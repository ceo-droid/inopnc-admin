# Change Propagation Rules

## Governing rules

Every command identifies SOURCE, ASSIGNMENT, and CALCULATION effects before it is accepted. Source evidence is append-preserved; assignment is mutable and audited; calculations refresh from active source and confirmed assignment. A command that crosses site/customer authorization or affects historical money requires explicit confirmation and reason.

## Required propagation cases

| Change | Direct and derived effects | Must remain unchanged | Confirmation / validation |
|---|---|---|---|
| Contract supply | Profit and cost ratio refresh | labor, expense, total cost | confirm; nullable or nonnegative |
| Cost budget | Budget remaining refresh | actual costs and contract | confirm; nullable or nonnegative; no inferred value |
| Worker current daily rate | Future entry default only | all historical snapshots and labor | confirm and audit |
| CALCULATED raw MD | countable MD and stored labor recompute using existing snapshot | current worker rate and expenses | NORMAL_WORK, MD nonnegative |
| HISTORICAL/MANUAL raw MD | MD changes; labor stays unless explicitly replaced | labor by default and provenance | keep/replace decision plus reason |
| Work-log site | Labor moves old → new site; site profit refreshes | company labor total and linked expenses | access to both sites; linked costs suggestions only |
| Transaction amount | correction/void/supersede; allocation validation reruns | original evidence and UUID | active allocation total ≤ new amount |
| Allocation site | expense moves old → new site | company expense total and source approval | access to both sites; amount positive |
| Allocation category | category totals move | source category and total expense | controlled category and reason |
| Operational customer | report grouping changes | legal/source alias and all cost facts | access to old/new customer scope |

## User workflow simulations

### Scenario 1 — S067 contract amount edit

- SOURCE: `sites.contract_supply_amount` changes with an audit record.
- ASSIGNMENT: none.
- CALCULATION: S067 expected profit and cost ratio refresh; budget remaining does not change.
- Invariant: labor, expenses, total cost, S068 results, and company total cost remain unchanged.

### Scenario 2 — 송용호 1 MD → 0.5 MD

- SOURCE: `raw_md` changes; original before-value remains in audit history.
- ASSIGNMENT: worker and site do not change.
- CALCULATION: if CALCULATED/NORMAL_WORK, `countable_md=0.5` and labor becomes `daily_rate_snapshot × 0.5`. If HISTORICAL_IMPORT or MANUAL_OVERRIDE, the user must explicitly keep or replace labor.
- Invariant: `workers.current_daily_rate`, transaction sources, and allocations remain unchanged.

### Scenario 3 — 송용호 worker daily-rate edit

- SOURCE: the worker's current default rate changes.
- ASSIGNMENT: none.
- CALCULATION: the next new work log receives the new snapshot; existing summaries do not change immediately.
- Invariant: every existing work-log snapshot and labor amount remains byte-for-byte unchanged.

### Scenario 4 — card 50,000 S068 → S067

- SOURCE: transaction/card approval remains unchanged.
- ASSIGNMENT: the confirmed active allocation changes site from S068 to S067.
- CALCULATION: S068 expense falls 50,000 and profit rises; S067 expense rises 50,000 and profit falls.
- Invariant: company expense/total cost and the card's original amount, approval data, and category source remain unchanged.

### Scenario 5 — card 100,000 split S067 60,000 / S068 40,000

- SOURCE: one 100,000 transaction.
- ASSIGNMENT: two positive active allocations totaling 100,000.
- CALCULATION: 60,000 enters S067 and 40,000 enters S068; mapping status becomes FULL.
- Invariant: source amount remains 100,000; company expense is counted once, never 200,000.

### Scenario 6 — upload the same card file again

- SOURCE: a new batch attempt may be logged, but duplicate transaction sources are not inserted.
- ASSIGNMENT: none is duplicated or replaced.
- CALCULATION: no totals change; duplicate count is reported in preview/result.
- Invariant: existing transaction UUIDs, allocations, and all financial summaries remain unchanged; inserted source count is zero.

### Scenario 7 — S068 work log moved to S067 with linked card candidate

- SOURCE: work-log source facts and all card approvals remain unchanged.
- ASSIGNMENT: work-log site changes to S067. Candidate expense allocations remain unchanged until user confirmation.
- CALCULATION: labor moves from S068 to S067 immediately; expense changes only for allocations the user confirms later.
- Invariant: company labor total is unchanged; no expense is force-moved based only on worker/date/name chronology.

## Suggestion policy

Related-expense detection may use worker, date/time, card, merchant, description, chronology, and source note. Its output is a ranked candidate set with `SUGGEST` or `REVIEW_REQUIRED`, never a forced reassignment. AUTO is allowed only for deterministic import metadata explicitly approved in preview; Yeosu wording alone cannot qualify.

## Void, supersede, and restore

- Transactions: correction creates a linked successor or explicit void; source payload and import evidence remain.
- Work logs: `is_active=false` excludes the row from MD/labor calculations; reason and actor are mandatory.
- Allocations: void/supersede retains assignment history and re-derives transaction mapping status.
- Restore: allowed only if no active successor conflicts and current RLS, allocation, date, and state invariants pass.
- Hard delete: reserved for pre-commit drafts with no audit/import identity; not for operational source records.

## Audit coverage

Site reassignment, raw-MD edits, labor overrides, allocation edits, transaction corrections/voids, contract/budget edits, and operational-customer changes write append-only before/after JSON, reason, actor, time, and USER/IMPORT/SYSTEM source. Import audit records the batch and fingerprint without storing secrets.

## RLS target matrix

The current database does not contain the profile/membership/access relations needed to enforce these roles. Target RLS therefore depends on authenticated `profiles`, organization/customer memberships, and explicit site access. Authorization data belongs in server-managed membership rows or `app_metadata`, never user-editable metadata. UPDATE needs both readable-row and new-row checks. Summary views use caller permissions.

Legend: Own = own worker rows; Assigned = explicit assigned sites; Partner = customer/contract read scope; NPC-1000 = only that company scope; All = all, including NPC-3000Q.

| Entity | worker | site_manager | partner | production_manager | admin |
|---|---|---|---|---|---|
| customers / aliases | R assigned customer; no C/U/V | R assigned; no source-alias mutation | R Partner; no C/U/V | R/C/U NPC-1000; V admin escalation | R/C/U/V All |
| sites | R Assigned; no C/U/V | R/U Assigned; no C/V | R Partner; no C/U/V | R/C/U/V NPC-1000 | R/C/U/V All |
| workers | R self/minimal assigned directory; U own non-auth profile only | R Assigned; no rate U unless delegated | no access except permitted display | R/C/U/V NPC-1000 | R/C/U/V All |
| work_logs | R Own; C Own Assigned; U/V own draft/allowed window | R/C/U/V Assigned | R summarized only | R/C/U/V NPC-1000 | R/C/U/V All |
| transactions | no raw-card access by default | R Assigned allocation context; no source C/U/V | summarized read only | R/C/U/V NPC-1000 | R/C/U/V All |
| expense_allocations | R own-linked redacted if needed; no C/U/V | R/C/U/V Assigned | summarized read only | R/C/U/V NPC-1000 | R/C/U/V All |
| import_batches | none | R own approved batches; C preview request only | none | R/C/U/V NPC-1000 | R/C/U/V All |
| financial_obligations | R only explicitly assigned own items | R/C/U Assigned; V by permission | R Partner | R/C/U/V NPC-1000 | R/C/U/V All |
| audit_logs | R own event subset | R Assigned; no C/U/V direct | R Partner redacted | R NPC-1000; no direct C/U/V | R All; system-only C; no U/V |
| summary view | R Assigned/Own visibility | R Assigned | R Partner | R NPC-1000 | R All |

NPC-3000Q is excluded from every production-manager predicate and is admin-only. No policy may stop at `TO authenticated`; it must include organization/customer/site ownership. The legacy public-all policies are a critical staged-removal dependency, not safe target policies.
