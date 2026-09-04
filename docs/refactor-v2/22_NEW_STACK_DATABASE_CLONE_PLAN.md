# New Stack Database Clone Plan

Status: **plan complete; execution requires clone-method review**. No database, GitHub, or Vercel state was changed.

## Safety precheck

The repository is clean on `main` at `3f4fd51`, with origin `https://github.com/ceo-droid/inopnc-admin.git`. The Supabase CLI link stored in `supabase/.temp/project-ref` correctly targets the new project `drferwbxvlsvcxcadyos`. However, `supabase/config.toml` still names the old Production ref `gbdcwxrnemirswlecwwh`. The CLI link passes, but every future command must verify the `.temp` ref immediately before execution, and the stale config value must be corrected or explicitly quarantined in a separately authorized configuration phase.

## Why migration replay is blocked

The eleven local migration files are not a complete reproduction source. Two are remote-history placeholders, and local migrations do not by themselves capture all managed Auth and Storage state, project settings, secrets, or stored files.

Simple replay is also unsafe. `20260218120000_harden_bidirectional_dedup_constraints.sql` normalizes and merges sites and workers, rewrites worklog references, removes business-key duplicate rows, and creates uniqueness over `(date, worker_id, site_id, md)`. That conflicts with S067/S068 separation, protected same-name multi-contract sites, and known valid worklog duplicates. The file remains unchanged and is classified `REPLAY_BLOCKED` for the new clone.

## Recommended method

Use a controlled current-schema and data export/import into the exact new target, backed by Supabase CLI dump/`pg_dump` semantics. Capture immutable source exports and manifests, validate an empty target, clone the current validated schema without replaying unsafe history, validate it, then import table data with explicit UUID values. Validate every table count and UUID set before proceeding.

Supabase's supported “Restore to a New Project” is the most complete platform-native database copy: it includes schema, data, indexes, roles, permissions, Auth records, and the encryption root key. It nevertheless creates a separate new project, requires a paid source with physical backups, and does not copy Storage objects/settings, Edge Functions, Auth settings/API keys, or several service settings. It therefore does not directly satisfy the fixed target ref in this plan. The CLI database dump is controllable for database-core schema and data, but its default behavior excludes managed `auth` and `storage` schemas; these require separate approved handling. See the [Supabase clone documentation](https://supabase.com/docs/guides/platform/clone-project) and [CLI database dump reference](https://supabase.com/docs/reference/cli/supabase-db-dump).

## Scope separation

- Public schema, views, routines, triggers, indexes, constraints, and RLS policies: inventory and clone from the current source state, followed by definition and role-matrix validation.
- Table data: import only after schema validation, preserving every site, worklog, worker, customer, and referenced UUID.
- Auth: create a separate managed-auth migration plan covering users, password hashes, identities, settings, redirect URLs, providers, and keys. Never improvise direct managed-schema restoration.
- Storage: migrate bucket metadata and actual object files separately, with object counts, sizes, paths, and hashes. Database dumps do not copy object payloads.
- Edge Functions: review the three local functions and deploy separately only after secrets and target bindings are approved.
- Secrets/environment values: recreate through approved secret stores; never save secret values in repository artifacts.

## Controlled order and gates

1. Capture a fresh SELECT-only source snapshot.
2. Record source counts, sorted UUID-set hashes, legacy-field hashes, schema object inventory, and file manifests.
3. Prove the new target is empty or matches an explicitly approved baseline.
4. Clone the current schema under separate approval.
5. Validate schemas, routines, triggers, indexes, constraints, and RLS.
6. Clone table data under separate approval with original UUIDs.
7. Validate every row count.
8. Validate every UUID set and foreign-key relationship.
9. Validate the 2260-worklog baseline, four post-canonical rows, financial totals, S067/S068 separation, multi-contract identities, and known duplicates.
10. Handle Auth, Storage, and Edge Functions through separate gates.
11. Apply the validated V2 additive schema (`fb49be217aebd73e5b8abc6bac8af929020ecd99f357b3633ca96cf25b6b4bb2`) to the new target only.
12. Perform the V2 worklog migration on the new target only.
13. Connect the new Vercel stack only after end-to-end validation.

Stop immediately for a wrong source or target ref, unexpected target data, source drift, UUID mismatch, destructive legacy cleanup, site identity merge risk, or valid-duplicate removal risk. The old Production database remains read-only throughout.
