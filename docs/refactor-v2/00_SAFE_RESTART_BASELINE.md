# INOPNC SW4 Safe Restart V2 — Phase 0 Baseline

## Status

`PASS` after Phase 0.1. The broader authorized search found exactly one source Excel, its immutable copy passed SHA256 verification, and the V2 dependency/build/test baseline was repaired. No generator was implemented or run.

## Workspace

| Item | Value |
|---|---|
| New workspace | `C:\Users\bobo\Desktop\260828\260828\inopnc-sw4-v2` |
| Repository | `https://github.com/ceo-droid/inopnc-sw4.git` |
| Branch | `refactor/v2-data-integrity-20260903` |
| Base | `origin/main` |
| Base HEAD | `0595d4e2ebe1a93d51e1457e6a109fe1af024ffc` |
| Initial worktree | CLEAN |

The existing `inopnc-sw4-clean` worktree and its untracked Phase 1 artifacts were left untouched. No branch, repository, or historical evidence was deleted.

## Connection identity

| Connection | Result | Evidence |
|---|---|---|
| GitHub | PASS | Origin is `ceo-droid/inopnc-sw4` |
| Supabase | PASS | `supabase/config.toml` project ref is `gbdcwxrnemirswlecwwh`; existing workspace URL host agrees |
| Vercel | PASS | Existing local link identifies `inopnc-sw4-publish`, project `prj_exCqRjCgA3rg76AhfgZ2rUgEXyOo`, org `team_2Z9tFmBMiqtuJxFxAoXww8RI` |

The new worktree has no `.vercel/project.json` or `.env.local`, which is normal for ignored local files. Existing workspace settings were read only as identity evidence. No secret or full key was printed or written.

## Source discovery

Phase 0.1 searched `C:\Users\bobo` while excluding AppData, node_modules, `.git`, dist, `.scoop`, and npm-cache.

Exactly one candidate was found:

- Original: `C:\Users\bobo\Desktop\260828\260828\cashbook_sorted_OUT1809_zero.xlsx`
- Size: 573,387 bytes
- LastWriteTime: `2026-09-02 16:11:44 +09:00`
- SHA256: `38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327`
- Immutable copy: `data-input/source_cashbook.xlsx`
- Copy SHA256: `38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327`
- Hash match: YES

The original was not moved or modified. Prior canonical/Master outputs were not used as source.

## Local-only structure

Created and ignored:

- `data-input/`
- `data-generated/`
- `.tmp/`

V2 reports live separately under `docs/refactor-v2/`, `artifacts/refactor-v2/`, and `scripts/refactor-v2/`.

## Current origin/main code risks

| Risk | Result |
|---|---|
| `daily || 150000` | FOUND — zero daily is replaced in client mapping; legacy import also defaults to 150,000 |
| `md || 1` | FOUND — Edge worklog import uses `parseFloat(...) || 1`, converting valid zero to one |
| Full-table delete import | FOUND — both worklog and optional expense imports can delete the full table |
| Transaction destructive dedup | FOUND — date + description + amount omits site/category/worker/source identity |
| Worklog destructive dedup | FOUND — date + worker + site + MD omits note/source identity |
| Normalized site-name unique | FOUND — normalized display name is enforced as unique despite separate-contract risk |
| Transaction worker persistence | NOT_FOUND — DB select/write schema omits `worker_id`; mapper forces an empty string |
| Historical labor recalculation | FOUND — UI uses current worker daily × historical MD |
| Expense category support | INCOMPLETE — 아침/점심/저녁/주유/숙박/자재/기타 only |
| 간식 | NOT_FOUND in typed/UI category list |
| 장비 | NOT_FOUND in typed/UI category list |
| Calendar blank date | FOUND — imports drop/reject blank or invalid dates rather than preserve review evidence |
| Calendar `+N` | FOUND — compressed month display renders remaining log-row count |
| Invoice/settlement status | PARTIAL — invoiced exists in type but UI transitions are incomplete; payment status is separate and nullable |
| RLS | HIGH RISK — core tables have permissive public `FOR ALL` policies; customer client policies permit anon writes |
| `sites.budget` semantics | MISNAMED — used as contract/revenue amount in profit calculations, not a true cost budget |

No application source was changed in Phase 0.

## Cleanup plan

Nothing was deleted.

- `SAFE_TO_DELETE`: regenerable prior-worktree `node_modules`/`dist`, plus `.tmp/node_modules-phase01-quarantine`, the incomplete V2 installation moved out of the active path after direct deletion was blocked by execution policy.
- `ARCHIVE_RECOMMENDED`: prior ignored `data-migration`, `artifacts/refactor`, and `docs/refactor` because they contain historical evidence and decisions but are not V2 source of truth.
- `KEEP`: both Git worktrees, tracked source, branches, configuration, migrations, and all original evidence pending explicit user action.

## Baseline commands

The incomplete V2 `node_modules` was the only active dependency directory targeted. No V2 node/vite process was holding it. Direct `Remove-Item` was blocked before execution by the command safety layer, so it was moved recoverably to ignored `.tmp/node_modules-phase01-quarantine`. No other worktree was touched.

`npm ci` then passed with 867 packages installed from the existing lockfile. Audit output reported 33 vulnerabilities (3 low, 6 moderate, 22 high, 2 critical); this was recorded only and `npm audit fix` was not run.

| Command | Result |
|---|---|
| `npm ci` | PASS |
| `npm run build` | PASS; existing Browserslist/chunk-size warnings |
| `npm test` | PASS — 2 files, 4 tests |
| baseline lint | FAIL — 59 errors, 7 warnings; no autofix |

## Safety outcome

- Production DB changed: NO
- Vercel deployed: NO
- Git pushed: NO
- Canonical/Master generated: NO
- Source copied: YES; SHA256 match

Next state: `READY_FOR_DATA_GENERATOR`. Phase 0.1 stops here; no canonical/Master generation, reconciliation, schema change, application implementation, deployment, or database write was performed.
