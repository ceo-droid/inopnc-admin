import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import XLSX from 'xlsx';

export const SOURCE_SHA256 = '38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327';
export const DATASET_VERSION = '2026-09-03.v2';
export const GENERATOR_VERSION = '1.0.0';
export const DETAIL_SHEET = '현장별_실시간_금전출납부';
export const SUMMARY_SHEET = '현장별_실시간_요약';
export const CATEGORIES = ['아침', '점심', '저녁', '간식', '자재', '주유', '숙박', '장비', '기타'];
const WORKLOG_COLUMNS = [
  'canonical_worklog_key','source_fingerprint','date','worker_name','site_code','site_name','entry_type','raw_md','countable_md',
  'daily_rate_snapshot','labor_amount','countable_labor_amount','cost_scope','source_customer_name','operational_customer_name',
  'source_sheet','source_excel_row','source_row_key','mapping_status','mapping_basis','review_reason','note',
];
const EXPENSE_COLUMNS = [
  'canonical_expense_key','source_fingerprint','date','approved_at','worker_name','card_last4','site_code','site_name','category','amount',
  'description','source_customer_name','operational_customer_name','source_sheet','source_excel_row','source_row_key','mapping_status','mapping_basis','review_reason',
];
const SITE_COLUMNS = [
  'site_code','site_name','operational_customer_name','source_customer_names','contract_supply_amount','cost_budget_amount','status',
  'actual_labor_cost','actual_expense_cost','actual_total_cost','expected_profit','cost_ratio','source_evidence','mapping_status','review_reason',
];
const TRACE_COLUMNS = [
  'source_workbook_sha256','source_sheet','source_excel_row','source_original_row_label','source_fingerprint','source_class','date','worker_name',
  'source_customer_name','operational_customer_name','source_site_code','final_site_code','source_site_name','final_site_name','worklog_count',
  'expense_record_count','labor_amount','expense_total','direct_cost','mapping_status','mapping_basis','review_reason',
];
const REVIEW_COLUMNS = ['review_id','source_fingerprint','entity_type','date','worker','source_site','candidate_site','amount_or_md','reason','recommended_action'];
const CHANGE_COLUMNS = ['change_id','source_fingerprint','entity_type','field','before','after','reason','rule_id'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha256 = (filename) => sha256(fs.readFileSync(filename));
const clean = (value) => String(value ?? '').replace(/\uFEFF/g, '').trim();
const headerKey = (value) => clean(value).normalize('NFKC').replace(/[\s_()（）/·.-]+/g, '').toLowerCase();
const number = (value) => {
  const parsed = Number(clean(value).replaceAll(',', '').replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const sum = (rows, field) => rows.reduce((total, row) => total + number(row[field]), 0);
const unique = (values) => [...new Set(values)];
const writeCsv = (filename, rows, columns) => fs.writeFileSync(filename, `\uFEFF${Papa.unparse(rows, { columns, newline: '\r\n' })}\r\n`, 'utf8');
const isoRange = (rows) => {
  const dates = rows.map((row) => row.date).filter(Boolean).sort();
  return { min: dates[0] ?? null, max: dates.at(-1) ?? null };
};

function findHeader(matrix, requiredHeaders) {
  const required = requiredHeaders.map(headerKey);
  for (let index = 0; index < Math.min(matrix.length, 30); index++) {
    const keys = new Set(matrix[index].map(headerKey));
    if (required.every((key) => keys.has(key))) return index;
  }
  throw new Error(`BLOCKED_SOURCE_SCHEMA: missing headers ${requiredHeaders.join(', ')}`);
}

function sheetRows(sheet, requiredHeaders) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const headerIndex = findHeader(matrix, requiredHeaders);
  const headers = matrix[headerIndex].map(clean);
  const rows = matrix.slice(headerIndex + 1).map((values, offset) => ({
    values,
    excelRow: headerIndex + 2 + offset,
    data: Object.fromEntries(headers.map((header, column) => [header, clean(values[column])])),
  }));
  return { matrix, headerIndex, headers, rows };
}

function isExpenseOnlyLabel(label) {
  return /^(WC|CX|EX|CA|C\d|E\d)/i.test(label) || /-CARD$/i.test(label);
}

function isCancelled(row) {
  return clean(row['표준현장명']) === '취소/제외' || /\[취소\/제외\]/.test(row['메모']);
}

function isWorklogRow(row) {
  return !isCancelled(row) && !isExpenseOnlyLabel(row['행']);
}

function sourceClass(row) {
  if (isCancelled(row)) return 'EXCLUDED_CANCELLED';
  const worklog = isWorklogRow(row);
  const expense = CATEGORIES.some((category) => number(row[category]) !== 0);
  if (worklog && expense) return 'WORKLOG_AND_EXPENSE';
  if (worklog) return 'WORKLOG_ONLY';
  return 'EXPENSE_ONLY';
}

function isYeosuSource(row) {
  return ['S067', 'S068'].includes(row['현장코드']) || /여수|죽림/.test(`${row['표준현장명']} ${row['메모']} ${row['매핑근거']}`);
}

function operationalCustomer(row, finalSiteCode) {
  return ['S067', 'S068'].includes(finalSiteCode) && isYeosuSource(row) ? '삼표피앤씨' : row['표준거래처'];
}

function isApprovedYeosuBaseRepair(row) {
  if (row['현장코드'] !== 'S068' || row['작업자'] !== '송용호') return false;
  if (row['일자'] < '2026-08-28' || row['일자'] > '2026-08-31') return false;
  const workEvidence = isWorklogRow(row) && /균열보수|잭자리.*미비구간.*노출마감/.test(row['메모'].replace(/\s+/g, ''));
  const expenseEvidence = /^CA\d+/i.test(row['행']) && row['카드끝4자리'] === '6903'
    && /여수권.*8\/29.*8\/31.*출역.*연속성/.test(row['매핑근거']);
  return workEvidence || expenseEvidence;
}

function finalSite(row) {
  if (isApprovedYeosuBaseRepair(row)) return { code: 'S067', rule: 'YEOSU_S067_BASE_REPAIR' };
  return { code: row['현장코드'], rule: '' };
}

function canonicalFingerprint(sourceSha, sheetName, excelRow, headers, row) {
  const content = headers.map((header) => [header, clean(row[header])]);
  return sha256(stable({ sourceSha, sheetName, excelRow, content }));
}

function meaningfulContentFingerprint(headers, row) {
  return sha256(stable(headers.map((header) => [header, clean(row[header])])));
}

function makeWorkbook(sheets) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = { Title: 'INOPNC Master V2', Subject: DATASET_VERSION, Author: 'INOPNC deterministic generator', CreatedDate: new Date('2026-09-03T00:00:00.000Z') };
  for (const [name, rows] of sheets) {
    const sheet = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    sheet['!autofilter'] = { ref: sheet['!ref'] };
    sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return workbook;
}

export function buildDataset(sourcePath) {
  const sourceSha = fileSha256(sourcePath);
  if (sourceSha !== SOURCE_SHA256) throw new Error(`BLOCKED_SOURCE_HASH_CHANGED: ${sourceSha}`);
  const sourceSize = fs.statSync(sourcePath).size;
  const workbook = XLSX.readFile(sourcePath, { cellDates: false, cellFormula: true });
  if (!workbook.SheetNames.includes(DETAIL_SHEET) || !workbook.SheetNames.includes(SUMMARY_SHEET)) {
    throw new Error('BLOCKED_SOURCE_SCHEMA: required sheets missing');
  }
  const detail = sheetRows(workbook.Sheets[DETAIL_SHEET], ['행','일자','작업자','현장코드','표준거래처','표준현장명','공수','인건비','직접원가합계']);
  const summary = sheetRows(workbook.Sheets[SUMMARY_SHEET], ['현장코드','표준거래처','표준현장명','현장예산','상태']);
  const requiredDetail = ['행','일자','작업자','현장코드','표준거래처','표준현장명','현장예산(부가세별도)','공수','인건비','메모','카드끝4자리','매핑근거','확인사유',...CATEGORIES];
  const headerSet = new Set(detail.headers.map(headerKey));
  if (!requiredDetail.every((header) => headerSet.has(headerKey(header)))) throw new Error('BLOCKED_SOURCE_SCHEMA: required detail columns missing');
  const sourceRows = detail.rows.filter(({ data }) => clean(data['행']) || clean(data['일자'])).map(({ data, excelRow }) => ({ ...data, excelRow }));

  const siteMetadata = new Map(summary.rows.filter(({ data }) => /^S\d+$/.test(data['현장코드'])).map(({ data }) => [data['현장코드'], data]));
  const fingerprints = new Map();
  for (const row of sourceRows) fingerprints.set(row, canonicalFingerprint(sourceSha, DETAIL_SHEET, row.excelRow, detail.headers, row));
  const worklogs = [];
  const expenses = [];
  const traces = [];
  const changes = [];
  let changeNumber = 0;

  for (const row of sourceRows) {
    const fingerprint = fingerprints.get(row);
    const site = finalSite(row);
    const finalMeta = siteMetadata.get(site.code) ?? {};
    const finalSiteName = finalMeta['표준현장명'] || row['표준현장명'];
    const operationCustomer = operationalCustomer(row, site.code);
    const mappingStatus = site.rule ? 'USER_APPROVED_RULE' : (row['확인사유'] ? 'SOURCE_REVIEW_FLAG' : 'SOURCE_CONFIRMED');
    if (site.rule) changes.push({
      change_id: `CH${String(++changeNumber).padStart(4, '0')}`, source_fingerprint: fingerprint, entity_type: 'SOURCE_ROW', field: 'site_code',
      before: row['현장코드'], after: site.code, reason: 'User-approved base Yeosu PC repair correction; independent balcony job remains S068', rule_id: site.rule,
    });
    if (operationCustomer !== row['표준거래처']) changes.push({
      change_id: `CH${String(++changeNumber).padStart(4, '0')}`, source_fingerprint: fingerprint, entity_type: 'SOURCE_ROW', field: 'operational_customer_name',
      before: row['표준거래처'], after: operationCustomer, reason: 'Preserve source/legal name while grouping Yeosu operations', rule_id: 'YEOSU_OPERATIONAL_CUSTOMER',
    });
    let worklogCount = 0;
    if (isWorklogRow(row)) {
      const holiday = row['표준현장명'] === '휴무';
      const other = row['표준현장명'] === '기타';
      const entryType = holiday ? 'HOLIDAY' : other ? 'OTHER' : 'NORMAL_WORK';
      const rawMd = number(row['공수']);
      const sourceLabor = number(row['인건비']);
      const labor = holiday ? 0 : sourceLabor;
      const dailyRate = rawMd > 0 && sourceLabor > 0 ? sourceLabor / rawMd : '';
      worklogs.push({
        canonical_worklog_key: `WL-${fingerprint.slice(0, 24)}`, source_fingerprint: fingerprint, date: row['일자'], worker_name: row['작업자'],
        site_code: site.code, site_name: finalSiteName, entry_type: entryType, raw_md: rawMd, countable_md: entryType === 'NORMAL_WORK' ? rawMd : 0,
        daily_rate_snapshot: dailyRate, labor_amount: labor, countable_labor_amount: entryType === 'NORMAL_WORK' ? labor : 0,
        cost_scope: entryType === 'NORMAL_WORK' ? 'site' : entryType === 'OTHER' ? 'overhead' : 'none', source_customer_name: row['표준거래처'],
        operational_customer_name: operationCustomer, source_sheet: DETAIL_SHEET, source_excel_row: row.excelRow, source_row_key: row['행'],
        mapping_status: mappingStatus, mapping_basis: site.rule || row['매핑근거'], review_reason: row['확인사유'], note: row['메모'],
      });
      worklogCount = 1;
    }
    let expenseCount = 0;
    for (const category of CATEGORIES) {
      const amount = number(row[category]);
      if (amount === 0 || isCancelled(row)) continue;
      expenses.push({
        canonical_expense_key: `EX-${fingerprint.slice(0, 20)}-${CATEGORIES.indexOf(category) + 1}`, source_fingerprint: fingerprint, date: row['일자'],
        approved_at: '', worker_name: row['작업자'], card_last4: row['카드끝4자리'], site_code: site.code, site_name: finalSiteName,
        category, amount, description: row['메모'], source_customer_name: row['표준거래처'], operational_customer_name: operationCustomer,
        source_sheet: DETAIL_SHEET, source_excel_row: row.excelRow, source_row_key: row['행'], mapping_status: mappingStatus,
        mapping_basis: site.rule || row['매핑근거'], review_reason: row['확인사유'],
      });
      expenseCount++;
    }
    const expenseTotal = CATEGORIES.reduce((total, category) => total + (isCancelled(row) ? 0 : number(row[category])), 0);
    traces.push({
      source_workbook_sha256: sourceSha, source_sheet: DETAIL_SHEET, source_excel_row: row.excelRow, source_original_row_label: row['행'],
      source_fingerprint: fingerprint, source_class: sourceClass(row), date: row['일자'], worker_name: row['작업자'], source_customer_name: row['표준거래처'],
      operational_customer_name: operationCustomer, source_site_code: row['현장코드'], final_site_code: site.code, source_site_name: row['표준현장명'],
      final_site_name: finalSiteName, worklog_count: worklogCount, expense_record_count: expenseCount, labor_amount: worklogCount ? number(row['인건비']) : 0,
      expense_total: expenseTotal, direct_cost: (worklogCount ? number(row['인건비']) : 0) + expenseTotal, mapping_status: mappingStatus,
      mapping_basis: site.rule || row['매핑근거'], review_reason: isCancelled(row) ? row['매핑근거'] : row['확인사유'],
    });
  }

  const reviewItems = [];
  const reviewKeys = new Set();
  const addReview = (row, entityType, candidate, amountOrMd, reason, action) => {
    const fingerprint = fingerprints.get(row);
    const key = `${fingerprint}|${entityType}|${reason}`;
    if (reviewKeys.has(key)) return;
    reviewKeys.add(key);
    reviewItems.push({ review_id: '', source_fingerprint: fingerprint, entity_type: entityType, date: row['일자'], worker: row['작업자'],
      source_site: row['현장코드'], candidate_site: candidate, amount_or_md: amountOrMd, reason, recommended_action: action });
  };
  for (const row of sourceRows) {
    if (row['확인사유'] && !isApprovedYeosuBaseRepair(row)) addReview(row, 'SOURCE_MAPPING', row['현장코드'], number(row['직접원가합계']), row['확인사유'], 'Verify against original evidence; do not auto-confirm');
    if (row['작업자'] === '임지만' && ['2025-03-17','2025-03-18','2025-03-19'].includes(row['일자']) && number(row['공수']) === 1 && number(row['인건비']) === 0) {
      addReview(row, 'UNRESOLVED_LABOR', row['현장코드'], number(row['공수']), 'Historical labor is unresolved; no daily rate may be inferred', 'Confirm historical payroll source');
    }
    if (isCancelled(row)) addReview(row, 'EXCLUDED_CANCELLED', '', 0, row['매핑근거'], 'Keep traced and excluded from active canonical rows');
  }
  const duplicateMap = new Map();
  for (const worklog of worklogs) {
    const key = [worklog.date, worklog.worker_name, worklog.site_code, worklog.raw_md].join('|');
    if (!duplicateMap.has(key)) duplicateMap.set(key, []);
    duplicateMap.get(key).push(worklog);
  }
  const duplicateGroups = [...duplicateMap.entries()].filter(([, rows]) => rows.length > 1 && unique(rows.map((row) => row.note)).length > 1);
  for (const [key, rows] of duplicateGroups) for (const worklog of rows) {
    const source = sourceRows.find((row) => fingerprints.get(row) === worklog.source_fingerprint);
    addReview(source, 'WORKLOG_DUPLICATE_CANDIDATE', worklog.site_code, worklog.raw_md, `Candidate group ${key}; notes/provenance differ`, 'Preserve all rows pending human review');
  }
  reviewItems.sort((a, b) => a.source_fingerprint.localeCompare(b.source_fingerprint) || a.entity_type.localeCompare(b.entity_type));
  reviewItems.forEach((row, index) => { row.review_id = `RV2-${String(index + 1).padStart(4, '0')}`; });

  const siteCosts = new Map();
  for (const site of siteMetadata.keys()) siteCosts.set(site, { labor: 0, expense: 0 });
  for (const row of worklogs) if (siteCosts.has(row.site_code)) siteCosts.get(row.site_code).labor += number(row.labor_amount);
  for (const row of expenses) if (siteCosts.has(row.site_code)) siteCosts.get(row.site_code).expense += number(row.amount);
  const sites = [...siteMetadata.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, row]) => {
    const related = sourceRows.filter((source) => finalSite(source).code === code);
    const sourceNames = unique(related.map((source) => source['표준거래처']).filter(Boolean)).sort();
    const costs = siteCosts.get(code);
    const contract = number(row['현장예산']);
    const total = costs.labor + costs.expense;
    return {
      site_code: code, site_name: row['표준현장명'], operational_customer_name: ['S067','S068'].includes(code) ? '삼표피앤씨' : row['표준거래처'],
      source_customer_names: sourceNames.join(' | '), contract_supply_amount: contract, cost_budget_amount: '', status: row['상태'],
      actual_labor_cost: costs.labor, actual_expense_cost: costs.expense, actual_total_cost: total,
      expected_profit: contract - total, cost_ratio: contract > 0 ? total / contract : '', source_evidence: `${SUMMARY_SHEET}; ${related.length} detailed source rows`,
      mapping_status: contract === 0 ? 'SOURCE_ZERO_AMOUNT' : 'SOURCE_CONFIRMED', review_reason: contract === 0 ? 'Cost budget is unknown; do not infer from zero legacy amount' : '',
    };
  });

  const sourceClassification = Object.fromEntries(['WORKLOG_AND_EXPENSE','WORKLOG_ONLY','EXPENSE_ONLY','EXCLUDED_CANCELLED'].map((key) => [key, traces.filter((row) => row.source_class === key).length]));
  const expenseCategoryTotals = Object.fromEntries(CATEGORIES.map((category) => [category, sum(expenses.filter((row) => row.category === category), 'amount')]));
  const affected = sourceRows.filter(isApprovedYeosuBaseRepair);
  const affectedFingerprints = new Set(affected.map((row) => fingerprints.get(row)));
  const reallocatedWorklogs = worklogs.filter((row) => affectedFingerprints.has(row.source_fingerprint));
  const reallocatedExpenses = expenses.filter((row) => affectedFingerprints.has(row.source_fingerprint));
  const s067 = sites.find((row) => row.site_code === 'S067');
  const s068 = sites.find((row) => row.site_code === 'S068');
  const validation = {
    dataset_version: DATASET_VERSION, generator_version: GENERATOR_VERSION, source_sha256: sourceSha,
    source_schema: { sheets: workbook.SheetNames, used_ranges: Object.fromEntries(workbook.SheetNames.map((name) => [name, workbook.Sheets[name]['!ref']])), detail_header_excel_row: detail.headerIndex + 1, summary_header_excel_row: summary.headerIndex + 1 },
    actual: {
      source_rows: sourceRows.length, source_trace_rows: traces.length,
      source_fingerprint_duplicates: fingerprints.size - new Set(fingerprints.values()).size,
      exact_meaningful_source_duplicates: sourceRows.length - new Set(sourceRows.map((row) => meaningfulContentFingerprint(detail.headers, row))).size,
      source_date_range: isoRange(traces), source_classification: sourceClassification, sites: sites.length,
      contract_amount_known_sites: sites.filter((row) => number(row.contract_supply_amount) !== 0).length,
      zero_unknown_legacy_amount_sites: sites.filter((row) => number(row.contract_supply_amount) === 0).length,
      worklogs: worklogs.length, worklog_date_range: isoRange(worklogs), raw_md: sum(worklogs, 'raw_md'), countable_md: sum(worklogs, 'countable_md'),
      labor: sum(worklogs, 'labor_amount'), countable_labor: sum(worklogs, 'countable_labor_amount'),
      other_overhead_labor: sum(worklogs.filter((row) => row.entry_type === 'OTHER'), 'labor_amount'),
      holiday_countable_md: sum(worklogs.filter((row) => row.entry_type === 'HOLIDAY'), 'countable_md'),
      other_countable_md: sum(worklogs.filter((row) => row.entry_type === 'OTHER'), 'countable_md'),
      expenses: expenses.length, expense_total: sum(expenses, 'amount'), category_totals: expenseCategoryTotals,
      direct_cost: sum(worklogs, 'labor_amount') + sum(expenses, 'amount'), duplicate_candidate_groups: duplicateGroups.length,
      unresolved_labor_rows: worklogs.filter((row) => row.worker_name === '임지만' && row.raw_md > 0 && number(row.labor_amount) === 0).length,
      review_rows: reviewItems.length,
      yeosu: {
        source_rows_affected: affected.length, worklog_rows_moved: reallocatedWorklogs.length, expense_records_moved: reallocatedExpenses.length,
        reallocated_labor: sum(reallocatedWorklogs, 'labor_amount'), reallocated_expense: sum(reallocatedExpenses, 'amount'),
        reallocated_total: sum(reallocatedWorklogs, 'labor_amount') + sum(reallocatedExpenses, 'amount'),
        s067_cost: s067.actual_total_cost, s067_contract_supply_amount: s067.contract_supply_amount, s067_expected_profit: s067.expected_profit, s067_cost_ratio: s067.cost_ratio,
        s068_cost: s068.actual_total_cost, s068_contract_supply_amount: s068.contract_supply_amount, s068_expected_profit: s068.expected_profit, s068_cost_ratio: s068.cost_ratio,
        combined_cost: s067.actual_total_cost + s068.actual_total_cost,
      },
    },
  };
  return { sourceSha, sourceSize, workbook, detail, summary, sourceRows, fingerprints, worklogs, expenses, sites, traces, reviewItems, changes, validation };
}

const EXPECTED = {
  source_rows: 2881, source_trace_rows: 2881, source_fingerprint_duplicates: 0, exact_meaningful_source_duplicates: 0,
  source_date_min: '2024-11-01', source_date_max: '2026-09-02', sites: 138, contract_amount_known_sites: 121, zero_unknown_legacy_amount_sites: 17,
  worklogs: 2338, worklog_date_min: '2025-01-01', worklog_date_max: '2026-08-31', raw_md: 2281, countable_md: 2200,
  labor: 663620000, countable_labor: 630005000, other_overhead_labor: 33615000, holiday_countable_md: 0, other_countable_md: 0,
  expenses: 4885, expense_total: 216525934, direct_cost: 880145934, duplicate_candidate_groups: 5, unresolved_labor_rows: 3,
  category_totals: { '아침':12022049,'점심':15362712,'저녁':16067392,'간식':10364251,'자재':19694919,'주유':36819633,'숙박':29069668,'장비':57485000,'기타':19640310 },
  source_classification: { WORKLOG_AND_EXPENSE:1333, WORKLOG_ONLY:1005, EXPENSE_ONLY:542, EXCLUDED_CANCELLED:1 },
  zero_codes: ['S071','S081','S096','S098','S107','S112','S119','S128','S149','S150','S164','S165','S166','S168','S169','S171','S173'],
  yeosu: { source_rows_affected:6, worklog_rows_moved:2, expense_records_moved:13, reallocated_labor:540000, reallocated_expense:259005, reallocated_total:799005,
    s067_cost:20730855,s067_contract_supply_amount:39989000,s067_expected_profit:19258145,s068_cost:9837520,s068_contract_supply_amount:17030000,s068_expected_profit:7192480 },
};

export function validateDataset(dataset) {
  const actual = dataset.validation.actual;
  const checks = [];
  const check = (name, actualValue, expectedValue) => checks.push({ name, actual: actualValue, expected: expectedValue, pass: stable(actualValue) === stable(expectedValue) });
  for (const key of ['source_rows','source_trace_rows','source_fingerprint_duplicates','exact_meaningful_source_duplicates','sites','contract_amount_known_sites','zero_unknown_legacy_amount_sites','worklogs','raw_md','countable_md','labor','countable_labor','other_overhead_labor','holiday_countable_md','other_countable_md','expenses','expense_total','direct_cost','duplicate_candidate_groups','unresolved_labor_rows']) check(key, actual[key], EXPECTED[key]);
  check('source_date_min', actual.source_date_range.min, EXPECTED.source_date_min); check('source_date_max', actual.source_date_range.max, EXPECTED.source_date_max);
  check('worklog_date_min', actual.worklog_date_range.min, EXPECTED.worklog_date_min); check('worklog_date_max', actual.worklog_date_range.max, EXPECTED.worklog_date_max);
  check('source_classification', actual.source_classification, EXPECTED.source_classification); check('category_totals', actual.category_totals, EXPECTED.category_totals);
  check('zero_codes', dataset.sites.filter((row) => number(row.contract_supply_amount) === 0).map((row) => row.site_code), EXPECTED.zero_codes);
  for (const [key, expected] of Object.entries(EXPECTED.yeosu)) check(`yeosu.${key}`, actual.yeosu[key], expected);
  check('financial_equation', actual.labor + actual.expense_total, actual.direct_cost);
  check('yeosu_total_cost_preserved', actual.yeosu.combined_cost, EXPECTED.yeosu.s067_cost + EXPECTED.yeosu.s068_cost);
  const result = { ...dataset.validation, status: checks.every((item) => item.pass) ? 'PASS' : 'FAIL', checks };
  if (result.status !== 'PASS') throw new Error(`GENERATOR_VALIDATION_FAILED: ${checks.filter((item) => !item.pass).map((item) => item.name).join(', ')}`);
  return result;
}

function outputHashes(outputDir, dataset, validation) {
  const files = ['sites_canonical.csv','worklogs_canonical.csv','expenses_canonical.csv','review_required.csv','source_trace.csv','generator_changes.csv','README.txt'];
  const hashes = Object.fromEntries(files.map((name) => [name, fileSha256(path.join(outputDir, name))]));
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) hashes['manifest.meaningful'] = sha256(stable({ ...JSON.parse(fs.readFileSync(manifestPath, 'utf8')), generated_at: null, output_hashes: null }));
  hashes['master.meaningful'] = sha256(stable([
    dataset.traces, dataset.sourceRows.map((row) => ({ source_excel_row: row.excelRow, source_row_key: row['행'], date: row['일자'], worker: row['작업자'], source_site_code: row['현장코드'], final_site_code: finalSite(row).code })),
    dataset.sites, dataset.changes, dataset.reviewItems,
  ]));
  hashes['validation.meaningful'] = sha256(stable({ ...validation, determinism: null, output_hashes: null }));
  return hashes;
}

export function writeDataset(dataset, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const validation = validateDataset(dataset);
  writeCsv(path.join(outputDir, 'sites_canonical.csv'), dataset.sites, SITE_COLUMNS);
  writeCsv(path.join(outputDir, 'worklogs_canonical.csv'), dataset.worklogs, WORKLOG_COLUMNS);
  writeCsv(path.join(outputDir, 'expenses_canonical.csv'), dataset.expenses, EXPENSE_COLUMNS);
  writeCsv(path.join(outputDir, 'review_required.csv'), dataset.reviewItems, REVIEW_COLUMNS);
  writeCsv(path.join(outputDir, 'source_trace.csv'), dataset.traces, TRACE_COLUMNS);
  writeCsv(path.join(outputDir, 'generator_changes.csv'), dataset.changes, CHANGE_COLUMNS);
  const masterRows = dataset.sourceRows.map((row) => {
    const fingerprint = dataset.fingerprints.get(row); const site = finalSite(row); const expenses = CATEGORIES.reduce((total, category) => total + (isCancelled(row) ? 0 : number(row[category])), 0);
    return { source_excel_row: row.excelRow, source_row_key: row['행'], '원본 거래처': row['표준거래처'], '표준 운영거래처': operationalCustomer(row, site.code),
      '원본 현장코드': row['현장코드'], '최종 현장코드': site.code, '원본 현장명': row['표준현장명'], '최종 현장명': dataset.sites.find((item) => item.site_code === site.code)?.site_name ?? row['표준현장명'],
      '원본 작업자': row['작업자'], '날짜': row['일자'], '원본 공수': number(row['공수']), 'countable 공수': isWorklogRow(row) && !['휴무','기타'].includes(row['표준현장명']) ? number(row['공수']) : 0,
      'historical labor': isWorklogRow(row) ? number(row['인건비']) : 0, 'expense total': expenses, mapping_status: site.rule ? 'USER_APPROVED_RULE' : row['확인사유'] ? 'SOURCE_REVIEW_FLAG' : 'SOURCE_CONFIRMED',
      mapping_basis: site.rule || row['매핑근거'], before_value: site.rule ? row['현장코드'] : '', after_value: site.rule ? site.code : '', change_reason: site.rule ? 'User-approved Yeosu base repair correction' : '', source_fingerprint: fingerprint };
  });
  const fieldDefinitions = [
    { field:'site_code', meaning:'Canonical business identity; display names may repeat' }, { field:'operational_customer_name', meaning:'Operational grouping; never overwrites legal/source name' },
    { field:'source_customer_name', meaning:'Original evidence name preserved verbatim' }, { field:'contract_supply_amount', meaning:'Contract supply/revenue-basis amount; not cost budget' },
    { field:'cost_budget_amount', meaning:'Planned cost budget; blank when unsupported' }, { field:'daily_rate_snapshot', meaning:'Historical source labor/raw MD only when safely derivable' },
    { field:'countable_md', meaning:'NORMAL_WORK raw MD; zero for HOLIDAY and OTHER' }, { field:'actual_total_cost', meaning:'Actual labor plus expense; calculated, not duplicated source state' },
  ];
  const master = makeWorkbook([
    ['01_원본추적', dataset.traces], ['02_정합성_MASTER', masterRows], ['03_현장별_손익', dataset.sites], ['04_수정이력', dataset.changes],
    ['05_REVIEW_REQUIRED', dataset.reviewItems], ['06_앱필드정의', fieldDefinitions],
  ]);
  XLSX.writeFile(master, path.join(outputDir, 'INOPNC_Master_v2.xlsx'), { compression: true });
  const readme = `INOPNC canonical reconciliation dataset ${DATASET_VERSION}\n\nSource: data-input/source_cashbook.xlsx\nSHA256: ${dataset.sourceSha}\n\nThe source workbook is the only source of truth. Original row values, legal/source customer names, Excel rows, and SHA256 fingerprints are preserved. site_code is the business identity; display names are not unique. Yeosu operational customer variants group under 삼표피앤씨 without overwriting legal/source names. S067 is base Yeosu PC repair; S068 is only the independent projecting-balcony steel-plate enlargement job. contract_supply_amount is contract supply/revenue amount. cost_budget_amount is separate and remains blank without evidence. HOLIDAY and OTHER have countable_md=0; OTHER historical labor is preserved as overhead. Historical labor is never recalculated from current worker rates. Canonical expense categories are 아침, 점심, 저녁, 간식, 자재, 주유, 숙박, 장비, 기타. Ambiguous mappings and duplicate candidates remain in review_required.csv and are never auto-deleted.\n\nThis is reconciliation source data, not a production apply package.\n`;
  fs.writeFileSync(path.join(outputDir, 'README.txt'), readme, 'utf8');
  const preliminaryHashes = outputHashes(outputDir, dataset, validation);
  const manifest = {
    dataset_version: DATASET_VERSION, source_filename: 'source_cashbook.xlsx', source_sha256: dataset.sourceSha, source_size: dataset.sourceSize,
    generated_at: new Date().toISOString(), generator_version: GENERATOR_VERSION, source_rows: validation.actual.source_rows, sites: validation.actual.sites,
    worklogs: validation.actual.worklogs, expenses: validation.actual.expenses, raw_md: validation.actual.raw_md, countable_md: validation.actual.countable_md,
    labor_amount: validation.actual.labor, countable_labor_amount: validation.actual.countable_labor, other_overhead_labor: validation.actual.other_overhead_labor,
    expense_total: validation.actual.expense_total, category_totals: validation.actual.category_totals, direct_cost: validation.actual.direct_cost,
    duplicate_candidate_groups: validation.actual.duplicate_candidate_groups, unresolved_labor_rows: validation.actual.unresolved_labor_rows,
    review_count: validation.actual.review_rows, yeosu_correction: validation.actual.yeosu, output_hashes: preliminaryHashes,
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  validation.output_hashes = outputHashes(outputDir, dataset, validation);
  fs.writeFileSync(path.join(outputDir, 'generator_validation.json'), `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
  return { validation, hashes: validation.output_hashes };
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(scriptDir, '..', '..', '..');
  const source = path.join(root, 'data-input', 'source_cashbook.xlsx');
  const output = path.join(root, 'data-generated');
  const dataset = buildDataset(source);
  const result = writeDataset(dataset, output);
  process.stdout.write(`${JSON.stringify({ status: result.validation.status, output, actual: result.validation.actual }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
