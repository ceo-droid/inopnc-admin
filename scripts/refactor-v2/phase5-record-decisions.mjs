import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd(), artifactDir=path.join(root,'artifacts','refactor-v2');
const sourcePath=path.join(artifactDir,'phase5-user-decisions.json');
const expectedSourceHash='c49b9e0c7cbdff5b171770d88b82668d9710de227d108b7a6917b86341f41ec1';
const hash=file=>crypto.hash('sha256',fs.readFileSync(file),'hex');
const read=name=>JSON.parse(fs.readFileSync(path.join(artifactDir,name),'utf8'));
const write=(file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n','utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const ids=text=>new Set(text.trim().split(/\s+/).filter(Boolean));

assert(hash(sourcePath)===expectedSourceHash,'Authoritative decision JSON changed before recording');
const source=read('phase5-user-decisions.json');
const phase5=read('phase5-worklog-summary.json');
const summary=read('phase5-user-decision-summary.json');
read('phase4-identity-resolution-map.json');
assert(source.dataset_version==='2026-09-03.v2','Canonical version changed');
assert(source.decisions.length===779&&summary.total_material_decisions===779,'Decision row count changed');
assert(phase5.canonical_count===2338&&phase5.production_current_count===2260&&phase5.post_canonical_count===4,'Phase5 accounting changed');
assert(phase5.duplicate_candidate_rows_protected===10,'Known duplicate protection changed');

const mdApproved=ids(`P5D-0008 P5D-0011 P5D-0012 P5D-0013 P5D-0063 P5D-0115 P5D-0164 P5D-0165 P5D-0168 P5D-0169 P5D-0174 P5D-0181 P5D-0182 P5D-0189`);
const mdReview=ids(`P5D-0001 P5D-0002 P5D-0003 P5D-0005 P5D-0055`);
const s098Semantic=ids(`P5D-0164 P5D-0165 P5D-0168 P5D-0169`);
const multiApproved=ids(`P5D-0085 P5D-0086 P5D-0119 P5D-0135`);
const pairedMissing=ids(`P5D-0318 P5D-0337 P5D-0338 P5D-0342 P5D-0350 P5D-0362 P5D-0366 P5D-0367 P5D-0373`);
const pairedMaterial=ids(`P5D-0019 P5D-0072 P5D-0080 P5D-0087 P5D-0103 P5D-0117 P5D-0130 P5D-0132 P5D-0149`);
const memoCanonicalBusiness=ids(`P5D-0423 P5D-0466 P5D-0469 P5D-0470 P5D-0471 P5D-0473 P5D-0474 P5D-0476 P5D-0477 P5D-0479 P5D-0480 P5D-0481 P5D-0483 P5D-0484 P5D-0486 P5D-0488 P5D-0490 P5D-0491 P5D-0493 P5D-0494 P5D-0496 P5D-0497 P5D-0500 P5D-0501 P5D-0504 P5D-0505 P5D-0506 P5D-0508 P5D-0509 P5D-0595 P5D-0643 P5D-0654`);
const memoKeepProduction=ids(`P5D-0405 P5D-0406 P5D-0410 P5D-0411 P5D-0412 P5D-0414 P5D-0416 P5D-0418 P5D-0671 P5D-0672 P5D-0674 P5D-0676 P5D-0677`);
const memoBusinessReview=ids(`P5D-0463 P5D-0464 P5D-0503 P5D-0507 P5D-0667 P5D-0668`);
const byId=new Map(source.decisions.map(row=>[row.decision_id,row]));
for(const set of [mdApproved,mdReview,s098Semantic,multiApproved,pairedMissing,pairedMaterial,memoCanonicalBusiness,memoKeepProduction,memoBusinessReview])for(const id of set)assert(byId.has(id),`Missing decision ID: ${id}`);
assert(mdApproved.size===14&&mdReview.size===5&&multiApproved.size===4&&pairedMissing.size===9&&memoCanonicalBusiness.size===32&&memoKeepProduction.size===13&&memoBusinessReview.size===6,'Approved ID list cardinality changed');

function record(row){
 let decision='',note='';
 if(row.site_change_kind==='BUSINESS_SITE_CORRECTION')decision='USE_CANONICAL_SITE';
 else if(row.classification==='UUID_CONSOLIDATION_ONLY')decision='USE_PRIMARY_SITE_UUID';
 else if(row.classification==='CORRECTION_WORKER')decision='USE_CANONICAL_WORKER';
 else if(row.classification==='CORRECTION_MD'){
   if(mdApproved.has(row.decision_id))decision='USE_CANONICAL_MD';
   else if(mdReview.has(row.decision_id)){decision='REVIEW_REQUIRED';note=row.decision_id==='P5D-0055'?'SOURCE_TRACE_REQUIRED_EMPTY_MEMO_MD_1_TO_0':'MD_SEMANTIC_CONFLICT_EXCLUDED_MD_VS_CANONICAL_COUNTABLE';}
 }
 else if(row.classification==='MULTI_FIELD_CORRECTION'){
   decision=multiApproved.has(row.decision_id)?'USE_CANONICAL_MULTI_FIELD':'REVIEW_REQUIRED';
   if(pairedMaterial.has(row.decision_id))note='PAIRED_SPLIT_ATOMIC_REVIEW';
 }
 else if(row.classification==='TRUE_MISSING_PRODUCTION_WORKLOG'){
   if(pairedMissing.has(row.decision_id)){decision='REVIEW_REQUIRED';note='PAIRED_SPLIT_ATOMIC_REVIEW';}
   else decision='INSERT_MISSING_CANDIDATE';
 }
 else if(row.priority==='P2_MISSING'){
   decision=['IDENTITY_UNRESOLVED','CANONICAL_ONLY_SITE','CANONICAL_ONLY_WORKER'].includes(row.classification)?'DEFER_IDENTITY':'REVIEW_REQUIRED';
 }
 else if(row.classification==='MEMO_CANONICAL_RICHER'){decision='USE_CANONICAL_MEMO';note='PRESERVE_PRODUCTION_MEMO_IN_SOURCE_AUDIT_HISTORY';}
 else if(row.classification==='MEMO_BUSINESS_DIFFERENCE'){
   if(memoCanonicalBusiness.has(row.decision_id)){decision='USE_CANONICAL_MEMO';note='PRESERVE_PRODUCTION_MEMO_IN_SOURCE_AUDIT_HISTORY';}
   else if(memoKeepProduction.has(row.decision_id)){decision='KEEP_AS_IS';note='PRODUCTION_MEMO_EQUAL_OR_RICHER_AVOID_INFORMATION_LOSS';}
   else if(memoBusinessReview.has(row.decision_id)){decision='REVIEW_REQUIRED';note='MEMO_BUSINESS_OR_SITE_MD_CONFLICT_SOURCE_TRACE_REQUIRED';}
 }
 else if(row.classification==='MEMO_REVIEW_REQUIRED')decision='REVIEW_REQUIRED';
 else if(row.priority==='P1_IDENTITY')decision=row.classification==='AMBIGUOUS_MULTIPLE_CANDIDATES'?'REVIEW_REQUIRED':'DEFER_IDENTITY';
 else if(row.priority==='P4_RETENTION')decision='KEEP_PRODUCTION_ONLY';
 assert(decision,`No decision rule for ${row.decision_id} (${row.classification})`);
 if(s098Semantic.has(row.decision_id))note='V2_SEMANTIC_ONLY_NO_LEGACY_MD_WRITE';
 return {...row,user_decision:decision,user_note:note};
}

const decisions=source.decisions.map(record);
const count=predicate=>decisions.filter(predicate).length;
const validation={decision_rows:decisions.length,blank_decisions:count(x=>!x.user_decision),p0_rows:count(x=>x.priority==='P0_CRITICAL'),site_business_approved:count(x=>x.site_change_kind==='BUSINESS_SITE_CORRECTION'&&x.user_decision==='USE_CANONICAL_SITE'),site_uuid_consolidation_approved:count(x=>x.classification==='UUID_CONSOLIDATION_ONLY'&&x.user_decision==='USE_PRIMARY_SITE_UUID'),worker_approved:count(x=>x.classification==='CORRECTION_WORKER'&&x.user_decision==='USE_CANONICAL_WORKER'),md_total:count(x=>x.classification==='CORRECTION_MD'),md_approved:count(x=>x.classification==='CORRECTION_MD'&&x.user_decision==='USE_CANONICAL_MD'),md_review:count(x=>x.classification==='CORRECTION_MD'&&x.user_decision==='REVIEW_REQUIRED'),multi_field_total:count(x=>x.classification==='MULTI_FIELD_CORRECTION'),multi_field_approved:count(x=>x.classification==='MULTI_FIELD_CORRECTION'&&x.user_decision==='USE_CANONICAL_MULTI_FIELD'),multi_field_review:count(x=>x.classification==='MULTI_FIELD_CORRECTION'&&x.user_decision==='REVIEW_REQUIRED'),true_missing:count(x=>x.classification==='TRUE_MISSING_PRODUCTION_WORKLOG'),missing_approved:count(x=>x.classification==='TRUE_MISSING_PRODUCTION_WORKLOG'&&x.user_decision==='INSERT_MISSING_CANDIDATE'),paired_missing_review:count(x=>pairedMissing.has(x.decision_id)&&x.user_decision==='REVIEW_REQUIRED'),memo_business_difference:count(x=>x.classification==='MEMO_BUSINESS_DIFFERENCE'),memo_canonical:count(x=>x.user_decision==='USE_CANONICAL_MEMO'),memo_keep_production:count(x=>x.classification==='MEMO_BUSINESS_DIFFERENCE'&&x.user_decision==='KEEP_AS_IS'),memo_review:count(x=>['MEMO_BUSINESS_DIFFERENCE','MEMO_REVIEW_REQUIRED'].includes(x.classification)&&x.user_decision==='REVIEW_REQUIRED'),production_only_keep:count(x=>x.priority==='P4_RETENTION'&&x.user_decision==='KEEP_PRODUCTION_ONLY'),deferred_identity_rows:count(x=>x.user_decision==='DEFER_IDENTITY'),post_canonical_preserved:phase5.post_canonical_count,known_duplicate_rows_preserved:phase5.duplicate_candidate_rows_protected};
const expected={decision_rows:779,blank_decisions:0,p0_rows:193,site_business_approved:61,site_uuid_consolidation_approved:13,worker_approved:1,md_total:19,md_approved:14,md_review:5,multi_field_total:99,multi_field_approved:4,multi_field_review:95,true_missing:62,missing_approved:53,paired_missing_review:9,memo_business_difference:51,memo_canonical:42,memo_keep_production:13,memo_review:238,production_only_keep:102,post_canonical_preserved:4,known_duplicate_rows_preserved:10};
for(const [field,value] of Object.entries(expected))assert(validation[field]===value,`Validation failed: ${field}=${validation[field]}, expected ${value}`);
for(const id of s098Semantic){const row=decisions.find(x=>x.decision_id===id);assert(row.expected.raw_md===1&&row.expected.countable_md===0&&row.user_note==='V2_SEMANTIC_ONLY_NO_LEGACY_MD_WRITE',`S098 semantic guard failed: ${id}`)}

function queueCategory(row){
 if(mdReview.has(row.decision_id))return {order:1,category:'MD_SEMANTIC_CONFLICT',required:'Original source row, exclusion/countable-MD rule, and historical MD evidence'};
 if(pairedMissing.has(row.decision_id)||pairedMaterial.has(row.decision_id))return {order:2,category:'PAIRED_SPLIT',required:'Both paired source traces and the single Production event; decide atomically'};
 if(row.classification==='MULTI_FIELD_CORRECTION')return {order:3,category:'MULTI_FIELD_CORRECTION',required:'Original workbook row plus date/site/worker/MD/memo chronology'};
 if(memoBusinessReview.has(row.decision_id))return {order:4,category:'MEMO_SITE_CONFLICT',required:'Original memo context, adjacent source rows, and site/MD chronology'};
 if(row.user_decision==='DEFER_IDENTITY')return {order:5,category:'DEFERRED_IDENTITY',required:'Site contract, month/floor/day-night chronology, workers, memo, and expense evidence'};
 return {order:6,category:'REMAINING_MEMO_OR_ROW_REVIEW',required:'Original workbook row and adjacent operational context'};
}
const queue=decisions.filter(x=>['REVIEW_REQUIRED','DEFER_IDENTITY'].includes(x.user_decision)).map(row=>{const q=queueCategory(row);return {review_order:q.order,review_category:q.category,decision_id:row.decision_id,canonical_worklog_key:row.canonical_worklog_key,production_uuid:row.production_worklog_uuid,date:row.date,site:{current:row.current.site,expected_code:row.expected.site_code,expected_uuid:row.expected.site_uuid},worker:{current:row.current.worker,expected:row.expected.worker},current:row.current,expected:row.expected,reason:row.user_note||row.evidence,required_source_evidence:q.required,user_decision:row.user_decision,user_note:row.user_note}}).sort((a,b)=>a.review_order-b.review_order||a.date.localeCompare(b.date)||a.decision_id.localeCompare(b.decision_id));
const finalDataset={...source,recorded_phase:'5.2',recorded_from_sha256:expectedSourceHash,decision_record_only:true,production_mutation:false,validation,decisions};
const canonicalMap={},productionMap={};
for(const row of decisions){if(row.canonical_worklog_key)(canonicalMap[row.canonical_worklog_key]??=[]).push({decision_id:row.decision_id,production_worklog_uuid:row.production_worklog_uuid,classification:row.classification,user_decision:row.user_decision,user_note:row.user_note});if(row.production_worklog_uuid)(productionMap[row.production_worklog_uuid]??=[]).push({decision_id:row.decision_id,canonical_worklog_key:row.canonical_worklog_key,classification:row.classification,user_decision:row.user_decision,user_note:row.user_note})}
const decisionMap={dataset_version:source.dataset_version,source_decision_sha256:expectedSourceHash,decision_rows:decisions.length,validation,by_canonical_worklog_key:canonicalMap,by_production_worklog_uuid:productionMap,protected_rules:{s067:'basic PC repair; primary 7cdd5e25-3c79-443f-bd17-105508a72661; never merge with S068',s068:'independent balcony steel-plate expansion; primary 819c0b09-d093-4717-a09d-86896d527845; never merge with S067',legacy_md:'raw_md and countable_md remain separate; no legacy Production md write',production_only:'KEEP; never a deletion candidate'}};
write('artifacts/refactor-v2/phase5-user-decisions-final.json',finalDataset);
write('artifacts/refactor-v2/phase5-worklog-decision-map.json',decisionMap);
write('artifacts/refactor-v2/phase5-source-trace-review-queue.json',{dataset_version:source.dataset_version,queue_rows:queue.length,review_required:queue.filter(x=>x.user_decision==='REVIEW_REQUIRED').length,defer_identity:queue.filter(x=>x.user_decision==='DEFER_IDENTITY').length,priority_order:['MD_SEMANTIC_CONFLICT','PAIRED_SPLIT','MULTI_FIELD_CORRECTION','MEMO_SITE_CONFLICT','DEFERRED_IDENTITY','REMAINING_MEMO_OR_ROW_REVIEW'],rows:queue});

const document=`# Phase 5.2 Worklog Decisions Final

## Scope and immutability

This phase records user-approved decision states only. The immutable source \`phase5-user-decisions.json\` retained SHA-256 \`${expectedSourceHash}\`. No Production query or mutation, SQL generation, migration, application change, expense reconciliation, deployment, commit, or push occurred.

## Recorded decisions

All 779 decision rows now have a decision: 61 business-site corrections use the Canonical site, 13 approved legacy-component events target the primary UUID for a future consolidation, and the single worker correction uses the Canonical worker. S067 remains basic PC repair and S068 remains the independent balcony steel-plate job; this decision set never merges them.

Fourteen of 19 MD corrections are approved and five require source-trace review. Four of 99 multi-field corrections are approved; the remaining 95 require review. Of 62 true-missing candidates, 53 are approved as future dry-run insert candidates and nine paired split rows remain atomic review items. These states do not authorize current inserts or updates.

## Memo policy

Ten Canonical-richer memos and 32 specifically approved business-difference memos use the Canonical operational memo while preserving the prior Production memo in audit/source history. Thirteen richer Production memos remain unchanged. The remaining 238 memo items require source review.

## Identity and retention

All unresolved identities remain DEFER_IDENTITY, including the nine Phase 4/5 deferred sites. All 102 Production-only rows remain KEEP_PRODUCTION_ONLY and are not deletion candidates. Four post-canonical rows and all ten known-valid duplicate rows remain protected.

## Raw/countable MD guard

P5D-0164, P5D-0165, P5D-0168, and P5D-0169 explicitly record \`raw_md = 1\`, \`countable_md = 0\`, and \`V2_SEMANTIC_ONLY_NO_LEGACY_MD_WRITE\`. A future schema must preserve both meanings; the single legacy Production \`md\` field must not be overwritten to emulate them.

## Next gate

The source-trace queue contains only REVIEW_REQUIRED and DEFER_IDENTITY decisions, ordered by MD semantic conflict, paired split, multi-field correction, memo/site conflict, deferred identity, and remaining memo review. Phase 5.3 source-trace review is required before any write plan. Phase 6 has not started.
`;
fs.writeFileSync(path.join(root,'docs','refactor-v2','14_WORKLOG_DECISIONS_FINAL.md'),document,'utf8');
assert(hash(sourcePath)===expectedSourceHash,'Authoritative decision JSON changed during recording');
console.log(JSON.stringify({source_sha256:expectedSourceHash,review_queue_rows:queue.length,validation},null,2));
