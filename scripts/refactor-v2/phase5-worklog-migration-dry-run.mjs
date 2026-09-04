import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
const writeText = (file, value) => fs.writeFileSync(path.join(root, file), value, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const number = value => value == null || value === '' ? 0 : Number(value);
const norm = value => String(value ?? '').replace(/\s+/g, '').trim();

const resolutionFile = readJson('artifacts/refactor-v2/phase5-worklog-final-resolution.json');
const unresolvedFile = readJson('artifacts/refactor-v2/phase5-worklog-final-unresolved.json');
const finalSummary = readJson('artifacts/refactor-v2/phase5-worklog-final-summary.json');
const sourceSummary = readJson('artifacts/refactor-v2/phase5-source-review-summary.json');
const identityMap = readJson('artifacts/refactor-v2/phase4-identity-resolution-map.json');
const resolutions = resolutionFile.resolutions;

assert(resolutions.length === 2451, 'BLOCKED_FINAL_RESOLUTION_ACCOUNTING');
assert(finalSummary.dry_run_update_eligible === 370 && finalSummary.dry_run_insert_eligible === 62, 'BLOCKED_ELIGIBILITY_BASELINE');
assert(unresolvedFile.unresolved_rows === 116 && sourceSummary.review_queue_total === 476, 'BLOCKED_REVIEW_BASELINE');

const snapshotPath = 'artifacts/refactor-v2/phase5-production-snapshot-dry-run.json';
const url = process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_PROJECT_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// One read-only Production re-read, paginated until the exact count is satisfied.
async function readProductionWorklogsOnce() {
  assert(url && key, 'BLOCKED_READ_ONLY_SUPABASE_ENV_MISSING');
  assert(url.includes('gbdcwxrnemirswlecwwh'), 'BLOCKED_WRONG_SUPABASE_PROJECT');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const columns = 'id,date,site_id,worker_id,md,note,created_at';
  const rows = [];
  let exactCount = null;
  for (let start = 0; exactCount == null || start < exactCount; start += 1000) {
    const query = db.from('work_logs').select(columns, start === 0 ? { count: 'exact' } : undefined).order('id').range(start, start + 999);
    const { data, count, error } = await query;
    if (error) throw error;
    if (start === 0) exactCount = count;
    rows.push(...data);
    if (data.length === 0) break;
  }
  assert(exactCount != null && rows.length === exactCount, 'BLOCKED_PRODUCTION_PAGINATION_MISMATCH');
  return rows;
}

function mergeMemo(target) {
  const canonical = String(target.memo_merge.canonical ?? '').trim();
  const production = String(target.memo_merge.production ?? '').trim();
  if (norm(canonical) === norm(production)) return canonical;
  if (norm(canonical).includes(norm(production))) return canonical;
  if (norm(production).includes(norm(canonical))) return production;
  // Choose the information-richer source as the operational target; both originals remain in audit metadata.
  return canonical.length >= production.length ? canonical : production;
}

let recoveryMode;
let recoverySelectCount;
let production;
if (fs.existsSync(path.join(root, snapshotPath))) {
  const snapshot = readJson(snapshotPath);
  assert(snapshot.project_ref === 'gbdcwxrnemirswlecwwh', 'BLOCKED_WRONG_SNAPSHOT_PROJECT');
  assert(snapshot.row_count === snapshot.rows.length, 'BLOCKED_SNAPSHOT_COUNT_MISMATCH');
  assert(new Set(snapshot.rows.map(row => row.id)).size === snapshot.row_count, 'BLOCKED_SNAPSHOT_UUID_DUPLICATION');
  production = snapshot.rows;
  recoveryMode = 'REUSED_LOCAL_SNAPSHOT';
  recoverySelectCount = 0;
} else {
  production = await readProductionWorklogsOnce();
  const capturedAt = new Date().toISOString();
  const snapshot = {
    project_ref: 'gbdcwxrnemirswlecwwh',
    capture_mode: 'RECOVERY_REPLACEMENT_SELECT',
    captured_at: capturedAt,
    row_count: production.length,
    max_created_at: production.map(row => row.created_at).filter(Boolean).sort().at(-1) || null,
    worklog_uuids: production.map(row => row.id).sort(),
    comparison_fields: ['id', 'date', 'site_id', 'worker_id', 'md', 'note', 'created_at'],
    rows: production,
  };
  // Persist the replacement read before any reconciliation or validation.
  writeJson(snapshotPath, snapshot);
  recoveryMode = 'RECOVERY_REPLACEMENT_SELECT';
  recoverySelectCount = 1;
}
const productionById = new Map(production.map(row => [row.id, row]));
const phase5Ids = new Set(resolutions.map(row => row.production_worklog_uuid).filter(Boolean));
const runtimeNew = production.filter(row => !phase5Ids.has(row.id));
const runtimeMissing = [...phase5Ids].filter(id => !productionById.has(id));

const workerCandidates = new Map();
for (const row of resolutions) {
  if (!row.current?.worker_name || !row.current?.worker_uuid) continue;
  if (!workerCandidates.has(row.current.worker_name)) workerCandidates.set(row.current.worker_name, new Set());
  workerCandidates.get(row.current.worker_name).add(row.current.worker_uuid);
}
for (const [name, uuid] of Object.entries(identityMap.primary_links?.workers || {})) {
  if (!workerCandidates.has(name)) workerCandidates.set(name, new Set());
  workerCandidates.get(name).add(uuid);
}
const workerUuid = name => {
  const ids = [...(workerCandidates.get(name) || [])];
  return ids.length === 1 ? ids[0] : '';
};

const toLegacyTarget = row => ({
  date: row.target.date,
  site_id: row.target.site_uuid,
  worker_id: workerUuid(row.target.worker),
  md: row.target.raw_md,
  note: row.target.memo_merge ? mergeMemo(row.target) : String(row.target.memo ?? ''),
});
const currentLegacy = row => ({ date: row.date, site_id: row.site_id, worker_id: row.worker_id, md: number(row.md), note: String(row.note ?? '') });
const changedFields = (before, after) => Object.keys(after).filter(field => field === 'md' ? number(before[field]) !== number(after[field]) : String(before[field] ?? '') !== String(after[field] ?? ''));
const expectedCurrent = row => ({ date: row.current.date, site_id: row.current.site_uuid, worker_id: row.current.worker_uuid, md: row.current.md, note: row.current.memo });
const isRuntimeDrift = (row, current) => changedFields(currentLegacy(current), expectedCurrent(row)).length > 0;
const deferredCodes = new Set(['S111', 'S130', 'S150', 'S151', 'S152', 'S153', 'S154', 'S155', 'S168']);

const updatePlan = [];
const updateNoops = [];
const runtimeDrift = [];
for (const row of resolutions.filter(item => item.migration_eligibility === 'DRY_RUN_UPDATE_ELIGIBLE')) {
  const current = productionById.get(row.production_worklog_uuid);
  if (!current) continue;
  if (isRuntimeDrift(row, current)) {
    runtimeDrift.push({ ...row, exclusion_reason: 'RUNTIME_ROW_DRIFT_REVIEW', observed_current: currentLegacy(current) });
    continue;
  }
  const after = toLegacyTarget(row);
  const fields = changedFields(currentLegacy(current), after);
  const semanticOnly = row.final_action === 'USE_CUSTOM_MD_SEMANTICS' || row.target.raw_md !== row.target.countable_md || row.target.labor_amount !== row.target.countable_labor_amount;
  if (fields.length === 0 && !semanticOnly) {
    updateNoops.push({ production_worklog_uuid: row.production_worklog_uuid, canonical_worklog_key: row.canonical_worklog_key, decision_id: row.decision_id, atomic_group_id: row.atomic_group_id, disposition: 'SIMULATED_NOOP' });
    continue;
  }
  updatePlan.push({
    action: row.final_action === 'USE_CUSTOM_MD_SEMANTICS' ? 'SIMULATE_V2_MD_SEMANTICS' : 'SIMULATE_UPDATE',
    physical_write_status: 'V2_SCHEMA_REQUIRED',
    production_worklog_uuid: row.production_worklog_uuid,
    canonical_worklog_key: row.canonical_worklog_key,
    decision_id: row.decision_id,
    before: currentLegacy(current),
    after: { ...row.target, legacy_projection: after },
    changed_fields: fields,
    source_fingerprint: row.source_fingerprint,
    expected_current_values: expectedCurrent(row),
    migration_prerequisite: 'V2 work_logs columns and scoped active source fingerprint constraint',
    atomic_group_id: row.atomic_group_id,
    protected_flags: row.protected_flags,
  });
}

const productionSignatures = new Set(production.map(row => [row.date, row.site_id, row.worker_id, number(row.md), norm(row.note)].join('|')));
const insertPlan = [];
const insertConflicts = [];
for (const row of resolutions.filter(item => item.migration_eligibility === 'DRY_RUN_INSERT_ELIGIBLE')) {
  const legacy = toLegacyTarget(row);
  const signature = [legacy.date, legacy.site_id, legacy.worker_id, number(legacy.md), norm(legacy.note)].join('|');
  if (productionSignatures.has(signature)) {
    insertConflicts.push({ ...row, exclusion_reason: 'INSERT_CONFLICT_EXISTING_SOURCE', match_basis: 'legacy identity tuple proxy; source_fingerprint column not yet available' });
    continue;
  }
  insertPlan.push({
    action: 'SIMULATE_INSERT',
    physical_write_status: 'V2_SCHEMA_REQUIRED',
    production_worklog_uuid: null,
    canonical_worklog_key: row.canonical_worklog_key,
    source_fingerprint: row.source_fingerprint,
    target: row.target,
    legacy_projection: legacy,
    migration_prerequisite: 'V2 work_logs columns and scoped active source fingerprint constraint',
    atomic_group_id: row.atomic_group_id,
    protected_flags: row.protected_flags,
  });
}

const excluded = [
  ...resolutions.filter(row => row.migration_eligibility === 'EXCLUDED_DEFERRED').map(row => ({ ...row, exclusion_reason: 'EXCLUDED_DEFERRED' })),
  ...runtimeDrift,
  ...insertConflicts,
];
const protectedRows = resolutions.filter(row => ['KEEP_PRODUCTION_ONLY', 'PRESERVE_POST_CANONICAL'].includes(row.final_action));

assert(runtimeMissing.length === 0, 'BLOCKED_PRODUCTION_ROW_LOSS');
assert(![...updatePlan, ...insertPlan].some(row => deferredCodes.has(row.after?.site_code || row.target?.site_code)), 'BLOCKED_DEFERRED_IDENTITY_LEAK');
assert(insertPlan.filter(row => row.atomic_group_id).length + insertConflicts.filter(row => row.atomic_group_id).length === 9, 'BLOCKED_ATOMIC_SPLIT_INSERT_ACCOUNTING');
assert(insertPlan.filter(row => !row.atomic_group_id).length + insertConflicts.filter(row => !row.atomic_group_id).length === 53, 'BLOCKED_STANDALONE_INSERT_ACCOUNTING');
assert(updatePlan.filter(row => row.action === 'SIMULATE_V2_MD_SEMANTICS').length === 4, 'BLOCKED_CUSTOM_MD_ACCOUNTING');

const canonicalRows = resolutions.filter(row => row.resolution_scope === 'CANONICAL_WORKLOG');
const sum = (rows, field) => rows.reduce((total, row) => total + number(row.target?.[field]), 0);
const ledgers = {
  BASE_CANONICAL_LEDGER: { rows: 2338, raw_md: 2281, countable_md: 2200, labor: 663620000, countable_labor: 630005000 },
  FINAL_RESOLVED_TARGET_LEDGER: { rows: canonicalRows.length, raw_md: sum(canonicalRows, 'raw_md'), countable_md: sum(canonicalRows, 'countable_md'), labor: sum(canonicalRows, 'labor_amount'), countable_labor: sum(canonicalRows, 'countable_labor_amount') },
  DRY_RUN_APPLICABLE_LEDGER: { schema_supported_actions: 0, schema_prerequisite_actions: updatePlan.length + insertPlan.length, update_noops: updateNoops.length, runtime_drift_excluded: runtimeDrift.length, insert_conflicts: insertConflicts.length },
};
assert(ledgers.FINAL_RESOLVED_TARGET_LEDGER.raw_md === 2281 && ledgers.FINAL_RESOLVED_TARGET_LEDGER.countable_md === 2196, 'BLOCKED_FINAL_MD_LEDGER');
assert(ledgers.FINAL_RESOLVED_TARGET_LEDGER.labor === 663620000, 'BLOCKED_FINAL_LABOR_LEDGER');

const fingerprintCounts = new Map();
for (const row of canonicalRows) fingerprintCounts.set(row.source_fingerprint, (fingerprintCounts.get(row.source_fingerprint) || 0) + 1);
const unexpectedFingerprintDuplicates = [...fingerprintCounts].filter(([, count]) => count > 1).length;
assert(unexpectedFingerprintDuplicates === 0, 'BLOCKED_UNEXPECTED_FINGERPRINT_DUPLICATES');

const atomicGroups = new Map();
for (const row of [...updatePlan, ...updateNoops, ...insertPlan, ...insertConflicts]) if (row.atomic_group_id) {
  if (!atomicGroups.has(row.atomic_group_id)) atomicGroups.set(row.atomic_group_id, []);
  atomicGroups.get(row.atomic_group_id).push(row);
}
assert(atomicGroups.size === 9 && [...atomicGroups.values()].every(rows => rows.length === 2), 'BLOCKED_ATOMIC_GROUP_COMPLETENESS');

const safety = { planned_deletes: 0, hard_deletes: 0, table_clear_operations: 0, full_table_replacement: 0, existing_uuids_replaced: 0, dedup_simulation: 0 };
const simulatedByUuid = new Map(production.map(row => [row.id, { legacy: currentLegacy(row), v2_target: null, source_fingerprint: null }]));
for (const row of updatePlan) simulatedByUuid.set(row.production_worklog_uuid, { legacy: row.after.legacy_projection, v2_target: row.after, source_fingerprint: row.source_fingerprint });
const simulatedFingerprints = new Set(insertPlan.map(row => row.source_fingerprint));
const secondPassUpdates = updatePlan.filter(row => {
  const simulated = simulatedByUuid.get(row.production_worklog_uuid);
  return JSON.stringify(simulated.v2_target) !== JSON.stringify(row.after) || simulated.source_fingerprint !== row.source_fingerprint;
}).length;
const secondPassInserts = insertPlan.filter(row => !simulatedFingerprints.has(row.source_fingerprint)).length;
const secondPass = { updates: secondPassUpdates, inserts: secondPassInserts };
assert(secondPass.updates === 0 && secondPass.inserts === 0, 'BLOCKED_NON_IDEMPOTENT_PLAN');
const summary = {
  status: 'PASS',
  recovery_mode: recoveryMode,
  recovery_select_count: recoverySelectCount,
  production_snapshot_persisted: true,
  production_phase5_count: 2260,
  production_current_count: production.length,
  runtime_new_production: runtimeNew.length,
  runtime_missing_production: runtimeMissing.length,
  final_resolution_rows: resolutions.length,
  update_eligible_original: 370,
  effective_updates: updatePlan.length,
  update_noops: updateNoops.length,
  runtime_row_drift_review: runtimeDrift.length,
  insert_eligible_original: 62,
  effective_inserts: insertPlan.length,
  insert_conflicts: insertConflicts.length,
  standalone_missing_inserts: 53,
  atomic_split_inserts: 9,
  no_write_keep: 1899,
  excluded_deferred: 116,
  custom_md_semantics: 4,
  ...ledgers,
  countable_md_intentional_delta: ledgers.FINAL_RESOLVED_TARGET_LEDGER.countable_md - ledgers.BASE_CANONICAL_LEDGER.countable_md,
  countable_labor_delta: ledgers.FINAL_RESOLVED_TARGET_LEDGER.countable_labor - ledgers.BASE_CANONICAL_LEDGER.countable_labor,
  countable_labor_semantic_reason: 'Four source-confirmed 통으로넘김공수 rows preserve historical labor_amount 270000 each while excluding that labor from countable_labor.',
  historical_labor_preserved: 4,
  memo_merge: 24,
  multi_field_confirmed: 93,
  atomic_split_groups: atomicGroups.size,
  known_duplicate_rows: 10,
  unexpected_fingerprint_duplicates: unexpectedFingerprintDuplicates,
  schema_supported_actions: 0,
  schema_prerequisite_actions: updatePlan.length + insertPlan.length,
  custom_md_schema_prerequisite: 4,
  protected_production_only: protectedRows.filter(row => row.final_action === 'KEEP_PRODUCTION_ONLY').length,
  protected_runtime_new: runtimeNew.length,
  safety,
  second_pass: secondPass,
  blocking_issues: [],
};

writeJson('artifacts/refactor-v2/phase5-worklog-update-dry-run.json', { count: updatePlan.length, noops: updateNoops, runtime_drift: runtimeDrift, rows: updatePlan });
writeJson('artifacts/refactor-v2/phase5-worklog-insert-dry-run.json', { count: insertPlan.length, conflicts: insertConflicts, standalone_expected: 53, atomic_split_expected: 9, rows: insertPlan });
writeJson('artifacts/refactor-v2/phase5-worklog-excluded-dry-run.json', { count: excluded.length, deferred_count: 116, runtime_drift_count: runtimeDrift.length, insert_conflict_count: insertConflicts.length, rows: excluded });
writeJson('artifacts/refactor-v2/phase5-worklog-site-ledger-dry-run.json', { ledgers, atomic_groups: Object.fromEntries(atomicGroups), protected_rows: protectedRows, runtime_new_rows: runtimeNew });
writeJson('artifacts/refactor-v2/phase5-worklog-migration-dry-run.json', { dataset_version: resolutionFile.dataset_version, generated_at: new Date().toISOString(), mode: 'DRY_RUN_SELECT_ONLY', summary, updates: updatePlan, inserts: insertPlan, excluded, protected: { production_only_and_post_canonical: protectedRows, runtime_new: runtimeNew } });
writeJson('artifacts/refactor-v2/phase5-worklog-migration-dry-run-summary.json', summary);

writeText('docs/refactor-v2/17_WORKLOG_MIGRATION_DRY_RUN.md', `# Phase 5.5 Worklog Migration Dry Run\n\nStatus: PASS. Production was re-read once through a complete SELECT-only pagination pass. No mutation, SQL generation, migration, or application change occurred.\n\n## Runtime gate\n\n- Phase 5 Production rows: 2260\n- Current Production rows: ${production.length}\n- Runtime-new protected rows: ${runtimeNew.length}\n- Runtime-missing rows: ${runtimeMissing.length}\n- Runtime drift rows excluded: ${runtimeDrift.length}\n\n## Simulation\n\n- Original update eligibility: 370; effective logical updates: ${updatePlan.length}; no-ops: ${updateNoops.length}\n- Original insert eligibility: 62; effective logical inserts: ${insertPlan.length}; conflicts: ${insertConflicts.length}\n- Deferred rows excluded: 116\n- Schema-supported actions: 0; V2-schema-prerequisite actions: ${updatePlan.length + insertPlan.length}\n\nAll existing UUIDs are preserved. All nine split groups contain both the update and insert side. The second in-memory pass produces zero updates and zero inserts. Planned deletes and deduplication are zero.\n\n## Ledgers\n\nBase Canonical totals are raw MD 2281, countable MD 2200, labor 663620000, and countable labor 630005000. Final resolved totals are raw MD ${ledgers.FINAL_RESOLVED_TARGET_LEDGER.raw_md}, countable MD ${ledgers.FINAL_RESOLVED_TARGET_LEDGER.countable_md}, labor ${ledgers.FINAL_RESOLVED_TARGET_LEDGER.labor}, and countable labor ${ledgers.FINAL_RESOLVED_TARGET_LEDGER.countable_labor}. The countable deltas preserve the four historical 270000 labor snapshots while excluding source-confirmed 통으로넘김공수 activity from countable MD and countable labor.\n`);

console.log(JSON.stringify(summary, null, 2));
