# Phase 5.10 Database Clone Method Final

Status: **PASS — plan only**. The selected method is `CONTROLLED_LOGICAL_CLONE_TO_EXISTING_TARGET`. No dump, import, SQL execution, database mutation, push, or deployment occurred.

## Final method decision

The source remains read-only at `gbdcwxrnemirswlecwwh`; the linked existing target is `drferwbxvlsvcxcadyos`. Current schema and current data must be exported rather than reconstructing the database from historical migrations. Migration replay remains prohibited, especially for `20260218120000_harden_bidirectional_dedup_constraints.sql`.

The future export package belongs only in `.tmp/db-clone/`, which is covered by `.gitignore`. Its planned files are `roles.sql`, `schema.sql`, `data.sql`, `manifest.json`, and `source-validation.json`. Dumps, user data, and credentials must never be committed.

Supabase CLI 2.116.0 confirms the required flags. A future approved export will use only environment variables, never literal credentials:

```powershell
$cloneDir = Join-Path (Get-Location) '.tmp\db-clone'
supabase db dump --db-url "$env:OLD_DB_URL" --file "$cloneDir\roles.sql" --role-only
supabase db dump --db-url "$env:OLD_DB_URL" --file "$cloneDir\schema.sql"
supabase db dump --db-url "$env:OLD_DB_URL" --file "$cloneDir\data.sql" --data-only --use-copy
```

These commands are documentation only and were not executed. Default CLI dumps exclude Supabase-managed Auth, Storage, and extension schemas, so they are not treated as a complete service clone. See the [Supabase CLI dump reference](https://supabase.com/docs/reference/cli/supabase-db-dump).

## Service inventory

No `supabase.auth`, `auth.users`, sign-in/sign-up, user/session, profile mapping, or worker/Auth linkage was found in the inspected application and schema references. `AUTH_MIGRATION_REQUIREMENT=NONE`; retaining existing Supabase Auth passwords is not functionally required by the current application. Discovery of out-of-repository Auth consumers would invalidate this classification and require a separate managed Auth plan.

Storage references define the public `imports` bucket and policies, but no application upload, download, signed-URL, or Storage client calls were found. The current classification is `METADATA_ONLY`. Before acceptance, perform a read-only bucket/object inventory; if operational objects exist, escalate to `FILES_REQUIRED` because SQL metadata does not copy object payloads.

The local functions `import-expenses`, `import-worklogs`, and `map-expenses` exist. No in-repository client invocation was found, but database cloning does not deploy function code, so `EDGE_FUNCTION_MIGRATION=REDEPLOY_REQUIRED` under a separate secrets and target-binding gate.

## Future controlled sequence

1. Capture the source read-only validation snapshot.
2. Capture and approve the target empty-state snapshot; unexpected application data blocks the clone and is never automatically cleared.
3. Export roles, the current application schema, and current application data.
4. Scan all export files for destructive legacy cleanup and record hashes in the manifest.
5. Import target schema only under explicit approval, then validate all application-owned tables, views, materialized views, functions, triggers, sequences, indexes, constraints, RLS policies, and custom types.
6. Import target data only under separate explicit approval, preserving every UUID.
7. Validate table counts, UUID sets, relationships, and financial/worklog invariants.
8. Handle Auth if the requirement changes, Storage metadata/files, Edge Functions, and secrets through separate gates.
9. Complete clone acceptance validation.

Before the later V2 worklog migration, the target must contain 2260 worklogs, including four post-canonical rows and ten known valid duplicate rows. S067 and S068 remain independent, all source UUIDs remain unchanged, orphan rows and unexpected removals remain zero, and the old Production database remains unchanged.

Only after clone acceptance may the validated Phase 5 V2 schema—11 columns, 4 constraints, and 2 indexes with SHA-256 `fb49be217aebd73e5b8abc6bac8af929020ecd99f357b3633ca96cf25b6b4bb2`—be considered for the new target.
