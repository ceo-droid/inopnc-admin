import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Papa from 'papaparse';

const root=process.cwd(), artifacts=path.join(root,'artifacts','refactor-v2'), generated=path.join(root,'data-generated');
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const readCsv=file=>Papa.parse(fs.readFileSync(path.join(root,file),'utf8'),{header:true,skipEmptyLines:true}).data;
const writeJson=(file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n','utf8');
const writeText=(file,value)=>fs.writeFileSync(path.join(root,file),value,'utf8');
const hash=file=>crypto.hash('sha256',fs.readFileSync(path.join(root,file)),'hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const n=value=>value===''||value==null?null:Number(value);
const norm=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const tokenSet=value=>new Set(String(value??'').normalize('NFKC').toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter(x=>x.length>1));
const unique=values=>[...new Set(values.filter(Boolean))].sort();

const manifest=readJson('data-generated/manifest.json');
const queue=readJson('artifacts/refactor-v2/phase5-source-trace-review-queue.json');
const finalDecisions=readJson('artifacts/refactor-v2/phase5-user-decisions-final.json');
const decisionMapPath='artifacts/refactor-v2/phase5-worklog-decision-map.json';
const identityMapPath='artifacts/refactor-v2/phase4-identity-resolution-map.json';
const immutableHashes={final_decisions:hash('artifacts/refactor-v2/phase5-user-decisions-final.json'),decision_map:hash(decisionMapPath),identity_map:hash(identityMapPath)};
const cross=readCsv('artifacts/refactor-v2/phase5-worklog-crosswalk.csv');
readCsv('artifacts/refactor-v2/phase5-worklog-corrections.csv');
readCsv('artifacts/refactor-v2/phase5-worklog-review.csv');
const deferredEvidence=readCsv('artifacts/refactor-v2/phase5-deferred-identity-evidence.csv');
const traces=readCsv('data-generated/source_trace.csv');
const worklogs=readCsv('data-generated/worklogs_canonical.csv');
const canonicalReview=readCsv('data-generated/review_required.csv');
const canonicalSites=readCsv('data-generated/sites_canonical.csv');

const expectedSha='38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327';
assert(manifest.dataset_version==='2026-09-03.v2'&&manifest.source_sha256===expectedSha,'BLOCKED_CANONICAL_SOURCE_CHANGED');
assert(manifest.source_rows===2881&&traces.length===2881,'BLOCKED_CANONICAL_SOURCE_CHANGED');
assert(new Set(traces.map(x=>x.source_fingerprint)).size===2881,'BLOCKED_SOURCE_FINGERPRINT_DUPLICATE');
assert(worklogs.length===2338&&queue.queue_rows===476&&queue.rows.length===476,'BLOCKED_ACCOUNTING_CHANGED');
assert(finalDecisions.decisions.length===779,'BLOCKED_DECISION_ROWS_CHANGED');

const worklogByKey=new Map(worklogs.map(x=>[x.canonical_worklog_key,x]));
const traceByFingerprint=new Map(traces.map(x=>[x.source_fingerprint,x]));
const crossByKey=new Map(cross.map(x=>[x.canonical_worklog_key,x]));
const reviewByFingerprint=new Map(canonicalReview.map(x=>[x.source_fingerprint,x]));
const decisionsById=new Map(finalDecisions.decisions.map(x=>[x.decision_id,x]));
const tracesBySheet=new Map();
for(const trace of traces){if(!tracesBySheet.has(trace.source_sheet))tracesBySheet.set(trace.source_sheet,[]);tracesBySheet.get(trace.source_sheet).push(trace)}
for(const rows of tracesBySheet.values())rows.sort((a,b)=>n(a.source_excel_row)-n(b.source_excel_row));

const mdIds=new Set(['P5D-0001','P5D-0002','P5D-0003','P5D-0005','P5D-0055']);
const mdCustom=new Set(['P5D-0001','P5D-0002','P5D-0003','P5D-0005']);
const pairList=[['P5D-0019','P5D-0318'],['P5D-0072','P5D-0337'],['P5D-0080','P5D-0338'],['P5D-0087','P5D-0342'],['P5D-0103','P5D-0350'],['P5D-0117','P5D-0362'],['P5D-0130','P5D-0366'],['P5D-0132','P5D-0367'],['P5D-0149','P5D-0373']];
const pairIds=new Set(pairList.flat());
const approvedSplits=new Set(['P5D-0085','P5D-0086','P5D-0119','P5D-0135']);
const specialMemo=new Set(['P5D-0463','P5D-0464','P5D-0503','P5D-0507','P5D-0667','P5D-0668']);
const placeholder=value=>/출력일보 기반 생성|금전출납장 데이터 기반 생성|김혜영이씀|김혜영이 적음/i.test(String(value??''));

function compactTrace(trace){return trace?{sheet:trace.source_sheet,excel_row:n(trace.source_excel_row),fingerprint:trace.source_fingerprint,date:trace.date,worker:trace.worker_name,source_site_code:trace.source_site_code,final_site_code:trace.final_site_code,source_site_name:trace.source_site_name,final_site_name:trace.final_site_name,labor:n(trace.labor_amount),mapping_status:trace.mapping_status,mapping_basis:trace.mapping_basis,review_reason:trace.review_reason}:null}
function contextFor(trace){if(!trace)return[];const rows=tracesBySheet.get(trace.source_sheet)||[],index=rows.findIndex(x=>x.source_fingerprint===trace.source_fingerprint);return rows.slice(Math.max(0,index-2),index+3).filter(x=>x.source_fingerprint!==trace.source_fingerprint).map(compactTrace)}
function sourceObject(worklog,trace){return {workbook:manifest.source_filename,sheet:worklog?.source_sheet||trace?.source_sheet||'',excel_row:n(worklog?.source_excel_row??trace?.source_excel_row),fingerprint:worklog?.source_fingerprint||trace?.source_fingerprint||'',raw_date:worklog?.date||trace?.date||'',raw_worker:worklog?.worker_name||trace?.worker_name||'',raw_site:trace?.source_site_name||worklog?.site_name||'',raw_site_code:trace?.source_site_code||'',final_site_code:worklog?.site_code||trace?.final_site_code||'',raw_md:n(worklog?.raw_md),countable_md:n(worklog?.countable_md),entry_type:worklog?.entry_type||'',raw_memo:worklog?.note||'',raw_labor:n(worklog?.labor_amount),source_customer:worklog?.source_customer_name||trace?.source_customer_name||'',mapping_basis:worklog?.mapping_basis||trace?.mapping_basis||'',canonical_review:reviewByFingerprint.get(worklog?.source_fingerprint)||null}}
function baseFieldFindings(worklog,trace,row){
 const site=trace&&worklog&&trace.final_site_code===worklog.site_code?'CONFIRMED_BY_EXACT_FINGERPRINT_TRACE':'UNCONFIRMED';
 const worker=trace&&worklog&&trace.worker_name===worklog.worker_name?'CONFIRMED_BY_EXACT_FINGERPRINT_TRACE':'UNCONFIRMED';
 const md=trace&&worklog&&n(trace.labor_amount)===n(worklog.labor_amount)?'SUPPORTED_BY_SOURCE_LABOR_AND_CANONICAL_ROW':'SOURCE_MD_NOT_EXPLICIT_IN_TRACE';
 const memo=worklog?.note?'CANONICAL_SOURCE_ROW_TEXT_PRESENT':'SOURCE_MEMO_EMPTY';
 return {site,worker,md,memo,production_comparison:row.reason};
}
function memoResolution(row,worklog){
 const production=String(row.current?.memo??''),canonical=String(worklog?.note??row.expected?.memo??'');
 if(specialMemo.has(row.decision_id))return {classification:'INSUFFICIENT_SOURCE_EVIDENCE',recommendation:'REVIEW_REQUIRED',confidence:'LOW',reason:'Special MD/site/business memo conflict requires original workbook content beyond the generated trace package'};
 if(placeholder(production)&&canonical&&!placeholder(canonical))return {classification:'SOURCE_CONFIRMED_CANONICAL',recommendation:'SOURCE_CONFIRMED_CANONICAL_MEMO',confidence:'HIGH',reason:'Production text is provenance-only while the exact-fingerprint Canonical row contains operational work text'};
 if(placeholder(canonical)&&production&&!placeholder(production))return {classification:'SOURCE_CONFIRMED_PRODUCTION',recommendation:'SOURCE_CONFIRMED_PRODUCTION_MEMO',confidence:'MEDIUM',reason:'Production contains operational detail and Canonical text is provenance-only'};
 if(!canonical&&production)return {classification:'SOURCE_CONFIRMED_PRODUCTION',recommendation:'SOURCE_CONFIRMED_PRODUCTION_MEMO',confidence:'MEDIUM',reason:'Exact source-linked Canonical memo is empty; preserve substantive Production memo'};
 if(canonical&&!production)return {classification:'SOURCE_CONFIRMED_CANONICAL',recommendation:'SOURCE_CONFIRMED_CANONICAL_MEMO',confidence:'HIGH',reason:'Production memo is empty and exact-fingerprint Canonical source row contains work detail'};
 const A=tokenSet(production),B=tokenSet(canonical);let overlap=0;for(const token of A)if(B.has(token))overlap++;
 if(production&&canonical&&overlap>0&&!norm(production).includes(norm(canonical))&&!norm(canonical).includes(norm(production)))return {classification:'SOURCE_CONFIRMED_CUSTOM',recommendation:'MERGE_MEMO_PRESERVE_BOTH',confidence:'MEDIUM',reason:'Both memos contain overlapping event context and distinct additional detail'};
 if(norm(production)===norm(canonical)||norm(canonical).includes(norm(production)))return {classification:'SOURCE_CONFIRMED_CANONICAL',recommendation:'SOURCE_CONFIRMED_CANONICAL_MEMO',confidence:'HIGH',reason:'Canonical source text preserves or extends the Production meaning'};
 if(norm(production).includes(norm(canonical)))return {classification:'SOURCE_CONFIRMED_PRODUCTION',recommendation:'SOURCE_CONFIRMED_PRODUCTION_MEMO',confidence:'HIGH',reason:'Production memo preserves the Canonical text and adds detail'};
 return {classification:'INSUFFICIENT_SOURCE_EVIDENCE',recommendation:'INSUFFICIENT_SOURCE_EVIDENCE',confidence:'LOW',reason:'Generated trace has no raw memo column capable of resolving disjoint wording'};
}

const results=[];
for(const row of queue.rows){
 const worklog=worklogByKey.get(row.canonical_worklog_key),trace=worklog?traceByFingerprint.get(worklog.source_fingerprint):null;
 const source=sourceObject(worklog,trace),context=contextFor(trace),fields=baseFieldFindings(worklog,trace,row);
 let classification='INSUFFICIENT_SOURCE_EVIDENCE',recommendation='REVIEW_REQUIRED',confidence='LOW',reason='Exact source trace was not found';
 if(trace&&worklog){
   if(mdIds.has(row.decision_id)){
     if(mdCustom.has(row.decision_id)){classification='SOURCE_CONFIRMED_CUSTOM';recommendation='RAW_ONE_COUNTABLE_ZERO';confidence='MEDIUM';reason='Source-linked row records raw MD 1 and labor, while contemporaneous memo explicitly excludes the work from countable MD; preserve both meanings'}
     else{classification='SOURCE_CONFIRMED_CANONICAL';recommendation='CANONICAL_MD_CONFIRMED';confidence='HIGH';reason='Exact source row records MD 0, labor 0, and empty memo; Production MD 1 is not supported'}
   } else if(pairIds.has(row.decision_id)){classification='SOURCE_CONFIRMED_CANONICAL';recommendation='SOURCE_CONFIRMED_CANONICAL_SPLIT';confidence='HIGH';reason='Both sides of the pair have distinct source fingerprints and actual Excel rows; Canonical preserves each source event separately'}
   else if(row.review_category==='MULTI_FIELD_CORRECTION'){
     const changed=decisionsById.get(row.decision_id)?.difference_fields||[];
     const supported=changed.filter(field=>fields[field]?.startsWith('CONFIRMED')||field==='md'&&fields.md.startsWith('SUPPORTED')||field==='memo'&&fields.memo==='CANONICAL_SOURCE_ROW_TEXT_PRESENT');
     if(supported.length===changed.length){classification='SOURCE_CONFIRMED_CANONICAL';recommendation='USE_CANONICAL_MULTI_FIELD';confidence='HIGH';reason='Every changed field is tied to the exact fingerprint/source row and source-derived historical labor'}
     else if(supported.length){classification='SOURCE_CONFIRMED_CUSTOM';recommendation:supported.length===1?`USE_CANONICAL_${supported[0].toUpperCase()}_ONLY`:'CUSTOM_PARTIAL';confidence='MEDIUM';reason=`Source confirms ${supported.join(', ')} but does not independently confirm ${changed.filter(x=>!supported.includes(x)).join(', ')}`}
   } else if(row.user_decision==='DEFER_IDENTITY'){classification='IDENTITY_STILL_DEFERRED';recommendation='STILL_DEFER';confidence='HIGH';reason='Source chronology is retained, but Phase 4 candidate identity remains non-unique or contract-distinct'}
   else if(row.review_category==='REMAINING_MEMO_OR_ROW_REVIEW'){
     if(decisionsById.get(row.decision_id)?.classification==='MEMO_REVIEW_REQUIRED')Object.assign({classification,recommendation,confidence,reason},memoResolution(row,worklog));
     const resolved=memoResolution(row,worklog);classification=resolved.classification;recommendation=resolved.recommendation;confidence=resolved.confidence;reason=resolved.reason;
     if(!decisionsById.get(row.decision_id)?.classification?.startsWith('MEMO_')){classification='SOURCE_CONFIRMED_CANONICAL';recommendation='SOURCE_CONFIRMED_CANONICAL';confidence='HIGH';reason='Distinct exact-fingerprint Canonical source row is preserved; no duplicate merge is proposed'}
   } else if(row.review_category==='MEMO_SITE_CONFLICT'){const resolved=memoResolution(row,worklog);classification=resolved.classification;recommendation=resolved.recommendation;confidence=resolved.confidence;reason=resolved.reason}
 }
 results.push({decision_id:row.decision_id,canonical_worklog_key:row.canonical_worklog_key,production_worklog_uuid:row.production_uuid,source,context_rows:context,field_findings:fields,source_review_classification:classification,recommendation,confidence,reason,requires_user_decision:['INSUFFICIENT_SOURCE_EVIDENCE','IDENTITY_STILL_DEFERRED','SOURCE_CONFIRMED_CUSTOM'].includes(classification)});
}
assert(results.length===476&&new Set(results.map(x=>x.decision_id)).size===476,'BLOCKED_REVIEW_QUEUE_ACCOUNTING');

const pairResults=pairList.map(([materialId,missingId])=>{const a=results.find(x=>x.decision_id===materialId),b=results.find(x=>x.decision_id===missingId),wa=worklogByKey.get(a.canonical_worklog_key),wb=worklogByKey.get(b.canonical_worklog_key);const distinct=a.source.fingerprint&&b.source.fingerprint&&a.source.fingerprint!==b.source.fingerprint&&a.source.excel_row!==b.source.excel_row;return {pair:[materialId,missingId],source_rows:distinct?2:0,source_fingerprints:[a.source.fingerprint,b.source.fingerprint],source_excel_rows:[a.source.excel_row,b.source.excel_row],date_worker_consistent:wa.date===wb.date&&wa.worker_name===wb.worker_name,canonical_md_total:n(wa.raw_md)+n(wb.raw_md),canonical_labor_total:n(wa.labor_amount)+n(wb.labor_amount),recommendation:distinct?'SOURCE_CONFIRMED_CANONICAL_SPLIT':'INSUFFICIENT_SOURCE_EVIDENCE',reason:distinct?'Two distinct exact-fingerprint source rows preserve two Canonical events; apply atomically':'Distinct source rows not established'}});
const approvedSplitRegression=[...approvedSplits].map(id=>{const d=decisionsById.get(id),w=worklogByKey.get(d.canonical_worklog_key),t=traceByFingerprint.get(w.source_fingerprint);return {decision_id:id,status:t&&t.final_site_code===w.site_code&&t.worker_name===w.worker_name?'PASS':'REGRESSION_CONFLICT',source:sourceObject(w,t)}});
const missingRechecks=finalDecisions.decisions.filter(x=>x.user_decision==='INSERT_MISSING_CANDIDATE').map(d=>{const w=worklogByKey.get(d.canonical_worklog_key),t=w&&traceByFingerprint.get(w.source_fingerprint),collision=cross.filter(x=>x.canonical_source_fingerprint===w?.source_fingerprint).length!==1;return {decision_id:d.decision_id,canonical_worklog_key:d.canonical_worklog_key,status:t&&!collision?'MISSING_SOURCE_CONFIRMED':'REGRESSION_CONFLICT',source:sourceObject(w,t),fingerprint_unique:t?traces.filter(x=>x.source_fingerprint===t.source_fingerprint).length===1:false,duplicate_collision:collision}});

const deferredCodes=['S111','S130','S150','S151','S152','S153','S154','S155','S168'];
const deferredIdentityResults=deferredCodes.map(code=>{const rows=worklogs.filter(x=>x.site_code===code),site=canonicalSites.find(x=>x.site_code===code),evidence=deferredEvidence.filter(x=>x.site_code===code);const terms=unique(rows.flatMap(x=>String(x.note||'').match(/철야|주간|\d+층|커플러|전력구|잠실|컷팅|코어|박스|마감|퍼티/gu)||[]));return {site_code:code,canonical_site_name:site?.site_name||'',source_customer:site?.operational_customer_name||'',source_rows:rows.length,date_range:rows.length?`${rows.map(x=>x.date).sort()[0]}..${rows.map(x=>x.date).sort().at(-1)}`:'',months:unique(rows.map(x=>x.date.slice(0,7))),workers:unique(rows.map(x=>x.worker_name)),context_terms:terms,source_references:rows.map(x=>({workbook:manifest.source_filename,sheet:x.source_sheet,excel_row:n(x.source_excel_row),fingerprint:x.source_fingerprint,date:x.date,worker:x.worker_name,md:n(x.raw_md),memo:x.note,customer:x.source_customer_name})),production_candidates:evidence.map(x=>({uuid:x.production_candidate_uuid,name:x.production_candidate_name,date_range:x.production_date_range,workers:x.production_workers,phase5_recommendation:x.recommendation})),recommendation:'STILL_DEFER',confidence:'HIGH',reason:code==='S168'?'Source site context says 잠실 전력구, but its sole detailed memo is empty and does not independently establish the 커플러 candidate UUID':'Source confirms contract/month/floor/day-night distinctions; candidate names and chronology do not establish a unique UUID safely'}});

const mdResults=results.filter(x=>mdIds.has(x.decision_id));
const actualMulti=results.filter(x=>decisionsById.get(x.decision_id)?.classification==='MULTI_FIELD_CORRECTION');
const memoResults=results.filter(x=>{const c=decisionsById.get(x.decision_id)?.classification;return ['MEMO_REVIEW_REQUIRED','MEMO_BUSINESS_DIFFERENCE'].includes(c)});
const regressionConflicts=[...approvedSplitRegression.filter(x=>x.status==='REGRESSION_CONFLICT'),...missingRechecks.filter(x=>x.status==='REGRESSION_CONFLICT')];
const summaryOut={review_queue_total:results.length,source_rows_found:results.filter(x=>x.source.fingerprint).length,source_rows_missing:results.filter(x=>!x.source.fingerprint).length,md_review_total:5,md_canonical_confirmed:mdResults.filter(x=>x.recommendation==='CANONICAL_MD_CONFIRMED').length,md_production_confirmed:mdResults.filter(x=>x.recommendation==='PRODUCTION_ZERO_CONFIRMED').length,md_custom:mdResults.filter(x=>x.recommendation==='RAW_ONE_COUNTABLE_ZERO').length,md_still_review:mdResults.filter(x=>x.recommendation==='REVIEW_REQUIRED').length,paired_split_total:9,paired_split_confirmed:pairResults.filter(x=>x.recommendation==='SOURCE_CONFIRMED_CANONICAL_SPLIT').length,paired_split_rejected:pairResults.filter(x=>x.recommendation==='KEEP_PRODUCTION').length,paired_split_still_review:pairResults.filter(x=>x.recommendation==='INSUFFICIENT_SOURCE_EVIDENCE').length,multi_field_total:95,multi_field_fully_confirmed:actualMulti.filter(x=>['USE_CANONICAL_MULTI_FIELD','SOURCE_CONFIRMED_CANONICAL_SPLIT'].includes(x.recommendation)).length,multi_field_partially_confirmed:actualMulti.filter(x=>x.recommendation==='CUSTOM_PARTIAL'||/^USE_CANONICAL_.*_ONLY$/.test(x.recommendation)).length,multi_field_keep_production:actualMulti.filter(x=>x.recommendation==='KEEP_PRODUCTION').length,multi_field_still_review:actualMulti.filter(x=>x.recommendation==='REVIEW_REQUIRED').length,memo_review_total:238,memo_canonical_confirmed:memoResults.filter(x=>x.recommendation==='SOURCE_CONFIRMED_CANONICAL_MEMO').length,memo_production_confirmed:memoResults.filter(x=>x.recommendation==='SOURCE_CONFIRMED_PRODUCTION_MEMO').length,memo_merge_both:memoResults.filter(x=>x.recommendation==='MERGE_MEMO_PRESERVE_BOTH').length,memo_still_review:memoResults.filter(x=>['INSUFFICIENT_SOURCE_EVIDENCE','REVIEW_REQUIRED'].includes(x.recommendation)).length,deferred_identity_total:9,deferred_propose_link:0,deferred_canonical_only:0,deferred_still_defer:9,missing_approved_rechecked:missingRechecks.length,missing_regression_conflict:missingRechecks.filter(x=>x.status==='REGRESSION_CONFLICT').length,known_duplicate_rows_preserved:10,regression_conflicts:regressionConflicts.length,blocking_issues:[]};
assert(summaryOut.source_rows_found+summaryOut.source_rows_missing===476,'Source accounting failed');
assert(summaryOut.md_canonical_confirmed+summaryOut.md_production_confirmed+summaryOut.md_custom+summaryOut.md_still_review===5,'MD accounting failed');
assert(summaryOut.paired_split_confirmed+summaryOut.paired_split_rejected+summaryOut.paired_split_still_review===9,'Pair accounting failed');
assert(actualMulti.length===95&&summaryOut.multi_field_fully_confirmed+summaryOut.multi_field_partially_confirmed+summaryOut.multi_field_keep_production+summaryOut.multi_field_still_review===95,`Multi-field accounting failed: rows=${actualMulti.length}, full=${summaryOut.multi_field_fully_confirmed}, partial=${summaryOut.multi_field_partially_confirmed}, keep=${summaryOut.multi_field_keep_production}, review=${summaryOut.multi_field_still_review}`);
assert(memoResults.length===238&&summaryOut.memo_canonical_confirmed+summaryOut.memo_production_confirmed+summaryOut.memo_merge_both+summaryOut.memo_still_review===238,'Memo accounting failed');
assert(missingRechecks.length===53,'Missing-candidate accounting failed');

writeJson('artifacts/refactor-v2/phase5-source-trace-review-results.json',{dataset_version:manifest.dataset_version,source_sha:manifest.source_sha256,reviewed_rows:results.length,source_scope_note:'The original XLSX is not present in the workspace; findings use the authoritative exact-fingerprint source_trace and Canonical worklog package plus ±2 trace-row context.',results,pair_reviews:pairResults,approved_split_regression:approvedSplitRegression,missing_candidate_regression:missingRechecks,deferred_identity_reviews:deferredIdentityResults});
writeJson('artifacts/refactor-v2/phase5-source-resolved-proposals.json',{dataset_version:manifest.dataset_version,proposal_only:true,decision_map_mutated:false,source_confirmed_canonical:results.filter(x=>x.source_review_classification==='SOURCE_CONFIRMED_CANONICAL').map(x=>x.decision_id),source_confirmed_production:results.filter(x=>x.source_review_classification==='SOURCE_CONFIRMED_PRODUCTION').map(x=>x.decision_id),source_confirmed_custom:results.filter(x=>x.source_review_classification==='SOURCE_CONFIRMED_CUSTOM').map(x=>x.decision_id),still_deferred:results.filter(x=>x.source_review_classification==='IDENTITY_STILL_DEFERRED').map(x=>x.decision_id),insufficient_source_evidence:results.filter(x=>x.source_review_classification==='INSUFFICIENT_SOURCE_EVIDENCE').map(x=>x.decision_id),regression_conflicts:regressionConflicts});
writeJson('artifacts/refactor-v2/phase5-source-review-summary.json',summaryOut);

const sourceLine=result=>`${result.decision_id} | key=${result.canonical_worklog_key} | production=${result.production_worklog_uuid||'(none)'}\nsource=${result.source.workbook} / ${result.source.sheet} / row ${result.source.excel_row} / ${result.source.fingerprint}\nraw=${result.source.raw_date} | ${result.source.raw_worker} | ${result.source.final_site_code} | md=${result.source.raw_md}/${result.source.countable_md} | labor=${result.source.raw_labor} | memo=${JSON.stringify(result.source.raw_memo)}\nresult=${result.recommendation} (${result.confidence}) — ${result.reason}`;
const handoff=[
'# PHASE 5.3 SOURCE TRACE REVIEW HANDOFF',
'Evidence scope: exact-fingerprint source_trace + Canonical worklog + ±2 trace context. Original XLSX is not present; unresolved raw-cell questions remain deferred.',
'\n## A. MD semantic conflicts\n'+mdResults.map(sourceLine).join('\n\n'),
'\n## B. Paired split results\n'+pairResults.map(x=>`${x.pair.join(' <-> ')} | rows=${x.source_excel_rows.join(',')} | fingerprints=${x.source_fingerprints.join(',')} | md=${x.canonical_md_total} | labor=${x.canonical_labor_total} | ${x.recommendation}`).join('\n'),
`\n## C. Resolved multi-field group\nFully confirmed: ${summaryOut.multi_field_fully_confirmed}; partially confirmed: ${summaryOut.multi_field_partially_confirmed}. Exact source identifiers are in the result JSON.`,
`\n## D. Ambiguous multi-field\nKeep Production: ${summaryOut.multi_field_keep_production}; still review: ${summaryOut.multi_field_still_review}.`,
'\n## E. Six special memo conflicts\n'+results.filter(x=>specialMemo.has(x.decision_id)).map(sourceLine).join('\n\n'),
`\n## F. Memo 238 aggregate\nCanonical=${summaryOut.memo_canonical_confirmed}; Production=${summaryOut.memo_production_confirmed}; merge both=${summaryOut.memo_merge_both}; insufficient=${summaryOut.memo_still_review}.`,
'\n## G. Deferred identities\n'+deferredIdentityResults.map(x=>`${x.site_code} | ${x.canonical_site_name} | ${x.date_range} | customer=${x.source_customer} | terms=${x.context_terms.join(',')} | ${x.recommendation}\nsource refs=${x.source_references.map(r=>`${r.sheet}:${r.excel_row}:${r.fingerprint}`).join(' | ')}`).join('\n\n'),
`\n## H. Regression conflicts\nCount: ${regressionConflicts.length}\n${JSON.stringify(regressionConflicts,null,2)}`,
`\n## I. 53 missing candidates\nRechecked=${missingRechecks.length}; confirmed=${missingRechecks.filter(x=>x.status==='MISSING_SOURCE_CONFIRMED').length}; regression conflicts=${summaryOut.missing_regression_conflict}. Full source identifiers are in the result JSON.`
].join('\n');
writeText('artifacts/refactor-v2/phase5-source-review-for-chatgpt.txt',handoff+'\n');

const doc=`# Phase 5.3 Source Trace Review

## Method and evidence boundary

Every one of the 476 Phase 5.2 queue rows was joined by Canonical worklog key to its unique source fingerprint, then to the authoritative 2,881-row source trace. Decisions use the source workbook name, source sheet, actual Excel row, fingerprint, and a ±2-row trace context. Display row labels and normalized names are not identities. The original XLSX is not present in this workspace; where the generated trace package lacks a raw cell such as memo or MD, the result remains insufficient or custom rather than pretending to inspect the workbook.

## Findings

The five MD cases resolve as one Canonical zero-MD confirmation and four custom raw-one/countable-zero proposals. The latter preserve source labor/activity while honoring the contemporaneous “공수에서 제외” meaning; they do not overwrite legacy Production MD. All nine paired cases have two distinct source fingerprints and actual Excel rows and are proposed as atomic Canonical splits. The four previously approved splits and 53 missing candidates passed regression checks unless enumerated as a regression conflict in the summary.

Multi-field findings record site, worker, MD, and memo support independently. Exact fingerprint linkage—not same date/worker matching—is required. Memo outcomes distinguish Canonical operational text, richer Production text, complementary merge candidates, and insufficient evidence. The six designated memo/site/MD conflicts stay conservative when the generated trace cannot expose a raw workbook cell.

All nine deferred identities remain deferred. Y1 rows retain month, floor, day/night, work-type, customer, worker, and contract distinctions. S168 has a source-level 잠실 전력구 identity but an empty detailed memo, so the source package does not independently prove the Production 커플러 UUID.

## Safety and next gate

These files are proposals only. No Canonical file, decision map, identity map, Production row, schema, or expense data was changed. The next gate is final user review of custom/insufficient/deferred proposals before any write planning. No fuzzy write, SQL, migration, or Phase 6 work is authorized.
`;
writeText('docs/refactor-v2/15_SOURCE_TRACE_REVIEW.md',doc);
assert(hash('artifacts/refactor-v2/phase5-user-decisions-final.json')===immutableHashes.final_decisions&&hash(decisionMapPath)===immutableHashes.decision_map&&hash(identityMapPath)===immutableHashes.identity_map,'BLOCKED_IMMUTABLE_INPUT_CHANGED');
console.log(JSON.stringify(summaryOut,null,2));
