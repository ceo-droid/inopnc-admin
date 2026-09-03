import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const draftDir = resolve(root, 'artifacts', 'refactor-v2', 'sql-drafts');
const required = ['00_preflight_v2.sql','01_schema_additive_v2.sql','02_constraints_v2.sql','03_financial_view_v2.sql','04_rls_v2_draft.sql','05_backfill_plan_v2.sql','99_post_validation_v2.sql'];
const files = readdirSync(draftDir).filter((name) => name.endsWith('.sql')).sort();
const failures = [];
for (const name of required) if (!files.includes(name)) failures.push(`missing ${name}`);

const strip = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\r\n]*/g, ' ').replace(/'(?:''|[^'])*'/g, "''");
const mutation = /\b(?:drop\s+table|truncate(?:\s+table)?|delete\s+from|insert\s+into|update\s+(?:public\.)?[a-z_][a-z0-9_]*\s+set)\b/i;
for (const name of files) {
  const body = strip(readFileSync(resolve(draftDir, name), 'utf8'));
  if (mutation.test(body)) failures.push(`production mutation/destructive statement in ${name}`);
  if ((name.startsWith('00_') || name.startsWith('99_')) && /\b(?:create|alter|grant|revoke)\b/i.test(body)) failures.push(`non-read-only validation SQL in ${name}`);
  if (name.startsWith('05_') && body.trim()) failures.push(`backfill plan contains executable SQL in ${name}`);
}

const migrationChanges = execFileSync('git', ['status','--porcelain','--','supabase/migrations'], { cwd: root, encoding: 'utf8' }).trim();
if (migrationChanges) failures.push('supabase/migrations contains changes');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${files.length} SQL drafts; no deployment-folder changes or prohibited data/destructive statements.`);
}
