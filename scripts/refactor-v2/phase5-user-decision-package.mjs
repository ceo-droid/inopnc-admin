import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const root=process.cwd();
const artifactDir=path.join(root,'artifacts','refactor-v2');
const readCsv=name=>Papa.parse(fs.readFileSync(path.join(artifactDir,name),'utf8'),{header:true,skipEmptyLines:true}).data;
const readJson=name=>JSON.parse(fs.readFileSync(path.join(artifactDir,name),'utf8'));
const readGeneratedCsv=name=>Papa.parse(fs.readFileSync(path.join(root,'data-generated',name),'utf8'),{header:true,skipEmptyLines:true}).data;
const write=(file,value)=>fs.writeFileSync(path.join(root,file),value,'utf8');
const n=value=>value===''||value==null?null:Number(value);
const norm=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const words=value=>new Set(String(value??'').normalize('NFKC').toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter(Boolean));
const range=rows=>rows.length?`${rows.map(x=>x.canonical_date||x.date).filter(Boolean).sort()[0]}..${rows.map(x=>x.canonical_date||x.date).filter(Boolean).sort().at(-1)}`:'';
const uniq=values=>[...new Set(values.filter(Boolean))].sort();
const countBy=(rows,getter)=>Object.fromEntries([...rows.reduce((m,row)=>{const k=getter(row);m.set(k,(m.get(k)||0)+1);return m},new Map())].sort(([a],[b])=>String(a).localeCompare(String(b))));
const expect=(condition,message)=>{if(!condition)throw new Error(message)};

const cross=readCsv('phase5-worklog-crosswalk.csv');
const corrections=readCsv('phase5-worklog-corrections.csv');
const reviews=readCsv('phase5-worklog-review.csv');
const productionLedger=readCsv('phase5-production-only-worklogs.csv');
const deferredEvidence=readCsv('phase5-deferred-identity-evidence.csv');
const phase5=readJson('phase5-worklog-summary.json');
const identity=readJson('phase4-identity-resolution-map.json');
const canonical=readGeneratedCsv('worklogs_canonical.csv');
const canonicalByKey=new Map(canonical.map(row=>[row.canonical_worklog_key,row]));
const crossByKey=new Map(cross.map(row=>[row.canonical_worklog_key,row]));

const expectedCounts={canonical_count:2338,production_current_count:2260,production_pre_cutoff_count:2256,post_canonical_count:4,exact_match:1549,safe_match:125,site_corrections:61,worker_corrections:1,md_corrections:19,memo_corrections:293,multi_field_corrections:99,canonical_only:70,production_only_pre_cutoff:102,review_required:13,unresolved_identity:108};
for(const [field,value] of Object.entries(expectedCounts))expect(phase5[field]===value,`Phase5 count changed: ${field}`);
expect(cross.length===2338,'Canonical crosswalk count changed');
expect(productionLedger.filter(x=>x.is_post_canonical==='true').length===4,'Post-canonical rows changed');
expect(corrections.length===473,'Correction source count changed');
expect(reviews.length===121,'Review source count changed');

const legacyByCode=new Map(Object.entries(identity.legacy_components||{}).map(([code,ids])=>[code,new Set(ids)]));
const deferredCodes=new Set(['S111','S130','S150','S151','S152','S153','S154','S155','S168']);
const canonicalOnlySiteCodes=new Set(['S167','S169','S170','S171','S173','S174','S175','S176']);
const y1Codes=new Set(['S111','S130','S150','S151','S152','S153','S154','S155']);
const duplicateSpecs=[['2025-10-18','김재형','S006',0.5],['2025-11-20','권용호','S083',1],['2025-11-20','김재형','S063',1],['2025-11-22','김재형','S063',1],['2025-12-23','김재형','S062',1]];
const duplicateKeySet=new Set();
for(const [date,worker,site,md] of duplicateSpecs){const rows=cross.filter(x=>x.canonical_date===date&&x.canonical_worker===worker&&x.canonical_site_code===site&&n(x.canonical_raw_md)===md);expect(rows.length===2,`Known duplicate group changed: ${date}/${worker}/${site}`);for(const row of rows)duplicateKeySet.add(row.canonical_worklog_key)}

function memoType(row){
 const current=String(row.production_memo??''), expected=String(row.canonical_memo??'');
 if(norm(current)===norm(expected))return 'MEMO_FORMAT_ONLY';
 const a=words(current),b=words(expected);let overlap=0;for(const token of a)if(b.has(token))overlap++;
 if(current&&expected&&(norm(expected).includes(norm(current))||a.size>0&&overlap===a.size&&b.size>a.size))return 'MEMO_CANONICAL_RICHER';
 if(current&&expected&&overlap===0)return 'MEMO_BUSINESS_DIFFERENCE';
 return 'MEMO_REVIEW_REQUIRED';
}
function siteGroup(row){
 if(['S067','S068'].includes(row.canonical_site_code))return 'YEOSU_S067_S068';
 if(y1Codes.has(row.canonical_site_code)||/용인|Y1|CUB/i.test(`${row.canonical_site_name} ${row.production_site_name}`))return 'YONGIN_Y1';
 if(norm(row.canonical_site_name)===norm(row.production_site_name))return 'SAME_NAME_SEPARATE_CONTRACT';
 return 'OTHER_SITE_CORRECTION';
}
function unresolvedReason(row){
 if(deferredCodes.has(row.canonical_site_code)||row.review_reason==='DEFERRED_SITE_IDENTITY')return 'DEFERRED_SITE_IDENTITY';
 if(row.canonical_worker==='임지만'||row.review_reason==='CANONICAL_ONLY_UNRESOLVED_WORKER')return 'CANONICAL_ONLY_WORKER';
 if(row.canonical_worker==='1톤스카이')return 'NON_WORKER_VALUE';
 if(canonicalOnlySiteCodes.has(row.canonical_site_code))return 'CANONICAL_ONLY_SITE';
 if(row.review_reason?.includes('multiple'))return 'AMBIGUOUS_MULTIPLE_CANDIDATES';
 if(!row.production_worklog_uuid)return 'MISSING_PRODUCTION_REFERENCE';
 return 'OTHER';
}
function canonicalOnlyReason(row){
 if(duplicateKeySet.has(row.canonical_worklog_key))return 'KNOWN_VALID_DUPLICATE_MISSING';
 if(['HOLIDAY','OTHER'].includes(row.canonical_entry_type))return 'SPECIAL_HOLIDAY_OTHER';
 if(deferredCodes.has(row.canonical_site_code))return 'IDENTITY_UNRESOLVED';
 if(canonicalOnlySiteCodes.has(row.canonical_site_code))return 'CANONICAL_ONLY_SITE';
 if(row.canonical_worker==='임지만')return 'CANONICAL_ONLY_WORKER';
 if(!row.production_worklog_uuid)return 'TRUE_MISSING_PRODUCTION_WORKLOG';
 return 'REVIEW_REQUIRED';
}
function productionOnlyReason(row){
 if(row.classification==='REVIEW_REQUIRED')return 'REVIEW_REQUIRED';
 const possible=cross.some(x=>!x.production_worklog_uuid&&x.canonical_date===row.date&&n(x.canonical_raw_md)===n(row.md)&&(x.canonical_worker===row.worker_name||x.canonical_site_name===row.site_name));
 if(possible)return 'POSSIBLE_CANONICAL_COUNTERPART';
 const legacy=[...legacyByCode.values()].some(ids=>ids.has(row.site_uuid));
 if(legacy)return 'LEGACY_DUPLICATE_LOOKING';
 const knownWorker=cross.some(x=>x.production_worker_uuid===row.worker_uuid), knownSite=cross.some(x=>x.production_site_uuid===row.site_uuid);
 if(!knownWorker||!knownSite)return 'IDENTITY_UNRESOLVED';
 return 'LIKELY_VALID_EXTRA';
}
function laborImpact(row){
 const source=canonicalByKey.get(row.canonical_worklog_key);
 const raw=n(row.canonical_raw_md), current=n(row.production_md), labor=n(source?.labor_amount);
 const historicalRate=raw!==null&&raw!==0&&labor!==null?labor/raw:null;
 const mdDelta=historicalRate!==null&&current!==null?labor-historicalRate*current:null;
 const siteChanged=row.field_differences?.split('|').includes('site');
 return {method:mdDelta!==null?'canonical_historical_labor_per_raw_md':'not_calculable_without_historical_rate',company_labor_delta_if_applied:mdDelta??0,current_site_labor_delta_if_applied:siteChanged&&labor!==null?-labor:0,expected_site_labor_delta_if_applied:siteChanged&&labor!==null?labor:0,historical_rate_used:historicalRate};
}
function baseDecision(row,priority,classification,action,confidence=row.confidence||'MEDIUM',extra={}){
 return {decision_id:'',priority,canonical_worklog_key:row.canonical_worklog_key||'',production_worklog_uuid:row.production_worklog_uuid||'',date:row.canonical_date||row.date||'',classification,current:{site:{uuid:row.production_site_uuid||row.site_uuid||'',name:row.production_site_name||row.site_name||''},worker:{uuid:row.production_worker_uuid||row.worker_uuid||'',name:row.production_worker_name||row.worker_name||''},md:n(row.production_md??row.md),memo:row.production_memo??row.memo??''},expected:{site_code:row.canonical_site_code||'',site_uuid:row.future_target_site_uuid||'',worker:row.canonical_worker||'',raw_md:n(row.canonical_raw_md),countable_md:n(row.canonical_countable_md),memo:row.canonical_memo||''},difference_fields:(row.field_differences||'').split('|').filter(Boolean),labor_impact:row.canonical_worklog_key?laborImpact(row):{method:'not_applicable',company_labor_delta_if_applied:0,current_site_labor_delta_if_applied:0,expected_site_labor_delta_if_applied:0,historical_rate_used:null},evidence:row.matching_basis||row.review_reason||row.reason||'',recommended_action:action,confidence,user_decision:'',user_note:'',...extra};
}

const decisions=[];
for(const row of cross){
 if(row.classification==='CORRECTION_SITE')decisions.push(baseDecision(row,'P0_CRITICAL',row.classification,'USE_CANONICAL_SITE',row.confidence,{site_correction_group:siteGroup(row),site_change_kind:'BUSINESS_SITE_CORRECTION'}));
 else if(row.classification==='CORRECTION_WORKER')decisions.push(baseDecision(row,'P0_CRITICAL',row.classification,'USE_CANONICAL_WORKER'));
 else if(row.classification==='CORRECTION_MD')decisions.push(baseDecision(row,'P0_CRITICAL',row.classification,'USE_CANONICAL_MD'));
 else if(row.classification==='MULTI_FIELD_CORRECTION')decisions.push(baseDecision(row,'P0_CRITICAL',row.classification,'USE_CANONICAL_MULTI_FIELD'));
 else if(row.classification==='CORRECTION_MEMO'){const type=memoType(row);decisions.push(baseDecision(row,'P3_LOW_RISK',type,['MEMO_FORMAT_ONLY','MEMO_CANONICAL_RICHER'].includes(type)?'USE_CANONICAL_MEMO':'REVIEW_REQUIRED'))}
 else if(row.classification==='UNRESOLVED_IDENTITY')decisions.push(baseDecision(row,'P1_IDENTITY',unresolvedReason(row),row.canonical_worker==='1톤스카이'?'NON_WORKER':'DEFER_IDENTITY','HIGH'));
 else if(row.classification==='REVIEW_REQUIRED')decisions.push(baseDecision(row,'P1_IDENTITY','AMBIGUOUS_MULTIPLE_CANDIDATES','REVIEW_REQUIRED','LOW'));
 else if(row.classification==='CANONICAL_ONLY'){const reason=canonicalOnlyReason(row);decisions.push(baseDecision(row,'P2_MISSING',reason,reason==='TRUE_MISSING_PRODUCTION_WORKLOG'||reason==='KNOWN_VALID_DUPLICATE_MISSING'?'INSERT_MISSING_CANDIDATE':'REVIEW_REQUIRED',reason==='TRUE_MISSING_PRODUCTION_WORKLOG'?'MEDIUM':'LOW'))}
}
for(const row of cross){const legacy=legacyByCode.get(row.canonical_site_code);if(legacy?.has(row.production_site_uuid)&&['EXACT_MATCH','SAFE_MATCH'].includes(row.classification))decisions.push(baseDecision(row,'P0_CRITICAL','UUID_CONSOLIDATION_ONLY','USE_PRIMARY_SITE_UUID','HIGH',{site_correction_group:'LEGACY_COMPONENT_TO_PRIMARY',site_change_kind:'UUID_CONSOLIDATION_ONLY'}))}
for(const row of productionLedger.filter(x=>x.classification==='PRODUCTION_ONLY'))decisions.push(baseDecision(row,'P4_RETENTION',productionOnlyReason(row),'KEEP_PRODUCTION_ONLY','HIGH'));
decisions.sort((a,b)=>a.priority.localeCompare(b.priority)||a.date.localeCompare(b.date)||a.canonical_worklog_key.localeCompare(b.canonical_worklog_key)||a.production_worklog_uuid.localeCompare(b.production_worklog_uuid));
decisions.forEach((row,index)=>row.decision_id=`P5D-${String(index+1).padStart(4,'0')}`);

const unresolvedRows=cross.filter(x=>x.classification==='UNRESOLVED_IDENTITY').map(row=>({...row,reason:unresolvedReason(row)}));
const unresolvedByReason={};
for(const reason of ['DEFERRED_SITE_IDENTITY','CANONICAL_ONLY_SITE','CANONICAL_ONLY_WORKER','NON_WORKER_VALUE','MISSING_PRODUCTION_REFERENCE','AMBIGUOUS_MULTIPLE_CANDIDATES','OTHER']){const rows=unresolvedRows.filter(x=>x.reason===reason);unresolvedByReason[reason]={count:rows.length,site_codes:uniq(rows.map(x=>x.canonical_site_code)),date_range:range(rows),workers:uniq(rows.map(x=>x.canonical_worker))}}
const canonicalOnlyDecisions=decisions.filter(x=>x.priority==='P2_MISSING');
const productionOnlyDecisions=decisions.filter(x=>x.priority==='P4_RETENTION');
const deferredTimeline={};
for(const code of deferredCodes){const rows=cross.filter(x=>x.canonical_site_code===code);const evidence=deferredEvidence.filter(x=>x.site_code===code);deferredTimeline[code]={canonical_rows:rows.length,date_range:range(rows),months:uniq(rows.map(x=>x.canonical_date.slice(0,7))),workers:uniq(rows.map(x=>x.canonical_worker)),memos:uniq(rows.map(x=>x.canonical_memo)).slice(0,20),production_candidates:evidence.map(x=>({uuid:x.production_candidate_uuid,name:x.production_candidate_name,date_range:x.production_date_range,workers:x.production_workers,recommendation:x.recommendation,reason:x.reason}))}}
const memoDecisions=decisions.filter(x=>x.priority==='P3_LOW_RISK');
const summary={dataset_version:phase5.dataset_version,generated_from_phase5:true,total_material_decisions:decisions.length,p0_critical:decisions.filter(x=>x.priority==='P0_CRITICAL').length,p1_identity:decisions.filter(x=>x.priority==='P1_IDENTITY').length,p2_missing:canonicalOnlyDecisions.length,p3_low_risk:memoDecisions.length,p4_retention:productionOnlyDecisions.length,memo_format_only:memoDecisions.filter(x=>x.classification==='MEMO_FORMAT_ONLY').length,memo_canonical_richer:memoDecisions.filter(x=>x.classification==='MEMO_CANONICAL_RICHER').length,memo_business_difference:memoDecisions.filter(x=>x.classification==='MEMO_BUSINESS_DIFFERENCE').length,memo_review_required:memoDecisions.filter(x=>x.classification==='MEMO_REVIEW_REQUIRED').length,site_business_corrections:decisions.filter(x=>x.site_change_kind==='BUSINESS_SITE_CORRECTION').length,site_uuid_consolidations:decisions.filter(x=>x.site_change_kind==='UUID_CONSOLIDATION_ONLY').length,site_correction_groups:countBy(decisions.filter(x=>x.site_correction_group),x=>x.site_correction_group),md_corrections:decisions.filter(x=>x.classification==='CORRECTION_MD').length,worker_corrections:decisions.filter(x=>x.classification==='CORRECTION_WORKER').length,true_missing_worklog_candidates:canonicalOnlyDecisions.filter(x=>x.classification==='TRUE_MISSING_PRODUCTION_WORKLOG').length,unresolved_by_reason:unresolvedByReason,canonical_only_by_reason:countBy(canonicalOnlyDecisions,x=>x.classification),production_only_by_reason:countBy(productionOnlyDecisions,x=>x.classification),deferred_identities:9,known_duplicate_rows_protected:duplicateKeySet.size,source_accounting:{canonical_rows:phase5.canonical_count,production_rows:phase5.production_current_count,production_pre_cutoff:phase5.production_pre_cutoff_count,post_canonical:phase5.post_canonical_count},user_decisions_pre_filled:false};

expect(summary.md_corrections===19,'MD correction count changed');
expect(summary.worker_corrections===1,'Worker correction count changed');
expect(summary.p1_identity===121,'P1 source count changed');
expect(summary.p2_missing===70,'Canonical-only count changed');
expect(summary.p3_low_risk===293,'Memo count changed');
expect(summary.p4_retention===102,'Production-only count changed');
expect(decisions.every(x=>x.user_decision===''&&x.user_note===''),'User decision was pre-filled');

const dataset={dataset_version:phase5.dataset_version,generated_from_phase5:true,source_phase5_summary:'artifacts/refactor-v2/phase5-worklog-summary.json',decision_policy:{production_mutation:false,default_production_only:'KEEP_PRODUCTION_ONLY',deferred_identity:'STILL_DEFER',memo_grouping:'293 memo differences categorized; only business differences are elevated for individual judgment'},deferred_timeline:deferredTimeline,decisions};
write('artifacts/refactor-v2/phase5-user-decisions.json',JSON.stringify(dataset,null,2)+'\n');
write('artifacts/refactor-v2/phase5-user-decision-summary.json',JSON.stringify(summary,null,2)+'\n');

const detail=d=>[
`[${d.decision_id}] ${d.classification}`,
`Canonical key: ${d.canonical_worklog_key||'(none)'}`,
`Production UUID: ${d.production_worklog_uuid||'(none)'}`,
`Date / worker / site: ${d.date} / ${d.expected.worker||d.current.worker.name} / ${d.expected.site_code||d.current.site.name}`,
`Current: site=${d.current.site.uuid} (${d.current.site.name}), worker=${d.current.worker.uuid} (${d.current.worker.name}), md=${d.current.md}, memo=${JSON.stringify(d.current.memo)}`,
`Expected: site=${d.expected.site_code} -> ${d.expected.site_uuid}, worker=${d.expected.worker}, raw_md=${d.expected.raw_md}, countable_md=${d.expected.countable_md}, memo=${JSON.stringify(d.expected.memo)}`,
`Evidence: ${d.evidence}`,
`Recommendation / confidence: ${d.recommended_action} / ${d.confidence}`,
''
].join('\n');
const sections=[];
sections.push('# PHASE 5.1R — WORKLOG USER DECISION REVIEW\n\nProduction is unchanged. Fill user_decision/user_note only in the JSON decision dataset after review.\n');
const ordered=[['1. MD corrections (19)',d=>d.classification==='CORRECTION_MD'],['2. Worker correction (1)',d=>d.classification==='CORRECTION_WORKER'],['3. Business site corrections',d=>d.site_change_kind==='BUSINESS_SITE_CORRECTION'],['4. Material multi-field corrections',d=>d.classification==='MULTI_FIELD_CORRECTION'],['6. True missing Production candidates',d=>d.classification==='TRUE_MISSING_PRODUCTION_WORKLOG'],['7. Memo business differences',d=>d.classification==='MEMO_BUSINESS_DIFFERENCE']];
for(const [title,test] of ordered){const rows=decisions.filter(test);sections.push(`\n## ${title}\n\nCount: ${rows.length}\n\n${rows.map(detail).join('\n')}`)}
sections.splice(5,0,`\n## 5. Deferred identities — timeline summary\n\n${Object.entries(deferredTimeline).map(([code,x])=>`${code}: ${x.canonical_rows} rows, ${x.date_range}; months=${x.months.join(', ')}; workers=${x.workers.join(', ')}\nCandidates:\n${x.production_candidates.map(p=>`- ${p.uuid} | ${p.name} | ${p.date_range} | ${p.recommendation}`).join('\n')}`).join('\n\n')}\n`);
write('artifacts/refactor-v2/phase5-user-review-for-chatgpt.txt',sections.join('\n'));

const doc=`# Phase 5.1R Worklog User Decisions

## Output mode and safety

This package was generated in JSON/TXT mode because the spreadsheet artifact runtime was unavailable. Existing Phase 5 CSV files were read as ordinary UTF-8 data through the repository's existing Papa Parse dependency. No CSV, workbook, Production query, database write, migration, application change, dependency installation, or Phase 6 activity was performed.

## Decision priorities

- P0_CRITICAL contains site, worker, MD, material multi-field corrections, plus approved legacy-component UUID consolidation candidates. These may affect allocation, historical interpretation, or future identity structure.
- P1_IDENTITY contains the 108 unresolved-identity rows and 13 ambiguous review rows. They are grouped by cause rather than presented as 121 unrelated identity questions.
- P2_MISSING contains the 70 canonical-only rows. This is evidence for review, not authorization to insert.
- P3_LOW_RISK contains 293 memo-only differences grouped as format-only, Canonical-richer, business-different, or review-required.
- P4_RETENTION contains 102 Production-only rows. The default is KEEP_PRODUCTION_ONLY; none is a deletion recommendation.

## Memo grouping

The 293 memo differences are not treated as 293 equal-risk questions. Pure representation differences and cases where the Canonical memo strictly adds detail recommend USE_CANONICAL_MEMO without applying it. Rows with disjoint business wording or insufficient semantic evidence remain explicit review items. This conservative lexical grouping is recommendation evidence only.

## Site and labor interpretation

S067 and S068 remain separate business identities. A correctly recorded S067/S068 event on an approved legacy UUID is UUID_CONSOLIDATION_ONLY; it is not mislabeled as a business-site error. Actual correction candidates outside the approved primary/legacy component set remain BUSINESS_SITE_CORRECTION. Site movement has zero company labor delta. MD deltas use the Canonical historical labor-per-raw-MD snapshot when calculable; current worker daily rates are never substituted.

## Deferred identities

S111, S130, S150, S151, S152, S153, S154, S155, and S168 remain STILL_DEFER. Their month/date, worker, memo, and Production-candidate chronology is embedded in the JSON dataset. Similar Y1/CUB naming does not justify merging monthly, floor-specific, day/night, or contract-specific identities.

## Required approval before any write

Users should first decide all MD and worker changes, business-site corrections, material multi-field corrections, unresolved identities, and true-missing candidates. Memo business differences follow. Production-only retention remains the safe default. The JSON user_decision and user_note fields are blank; completing this package does not authorize a database write or migration.
`;
write('docs/refactor-v2/13_WORKLOG_USER_DECISIONS.md',doc);
console.log(JSON.stringify(summary,null,2));
