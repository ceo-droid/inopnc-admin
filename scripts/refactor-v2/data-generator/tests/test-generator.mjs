import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset, writeDataset } from '../generate-v2.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..', '..');
const source = path.join(root, 'data-input', 'source_cashbook.xlsx');
const tempRoot = path.join(root, '.tmp', 'generator-determinism-test');
const firstDir = path.join(tempRoot, 'run-1');
const secondDir = path.join(tempRoot, 'run-2');

fs.rmSync(tempRoot, { recursive: true, force: true });
fs.mkdirSync(firstDir, { recursive: true });
fs.mkdirSync(secondDir, { recursive: true });

const firstDataset = buildDataset(source);
const first = writeDataset(firstDataset, firstDir);
const secondDataset = buildDataset(source);
const second = writeDataset(secondDataset, secondDir);

const comparableHashKeys = [
  'sites_canonical.csv', 'worklogs_canonical.csv', 'expenses_canonical.csv', 'review_required.csv',
  'source_trace.csv', 'generator_changes.csv', 'README.txt', 'manifest.meaningful',
  'master.meaningful', 'validation.meaningful',
];
for (const key of comparableHashKeys) assert.equal(first.hashes[key], second.hashes[key], `Non-deterministic output: ${key}`);
assert.deepEqual(first.validation.actual, second.validation.actual);
assert.deepEqual(
  firstDataset.worklogs.map((row) => row.source_fingerprint),
  secondDataset.worklogs.map((row) => row.source_fingerprint),
);

const determinism = {
  status: 'PASS',
  runs: 2,
  compared_hashes: Object.fromEntries(comparableHashKeys.map((key) => [key, first.hashes[key]])),
  excluded_time_fields: ['manifest.generated_at'],
};
const finalValidationPath = path.join(root, 'data-generated', 'generator_validation.json');
const finalValidation = JSON.parse(fs.readFileSync(finalValidationPath, 'utf8'));
finalValidation.determinism = determinism;
fs.writeFileSync(finalValidationPath, `${JSON.stringify(finalValidation, null, 2)}\n`, 'utf8');
const artifactDir = path.join(root, 'artifacts', 'refactor-v2');
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'data-generator-validation.json'), `${JSON.stringify(finalValidation, null, 2)}\n`, 'utf8');

fs.rmSync(tempRoot, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify(determinism, null, 2)}\n`);
