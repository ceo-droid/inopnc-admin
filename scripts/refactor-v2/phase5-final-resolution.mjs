import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Papa from 'papaparse';

const root=process.cwd();
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const readCsv=file=>Papa.parse(fs.readFileSync(path.join(root,file),'utf8'),{header:true,skipEmptyLines:true}).data;
const writeJson=(file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n','utf8');
const writeText=(file,value)=>fs.writeFileSync(path.join(root,file),value,'utf8');
const hash=file=>crypto.hash('sha256',fs.readFileSync(path.join(root,file)),'hex');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const n=value=>value===''||value==null?null:Number(value);

const immutablePaths=['artifacts/refactor-v2/phase5-user-decisions-final.json','artifacts/refactor-v2/phase5-worklog-decision-map.json','artifacts/refactor-v2/phase5-source-trace-review-results.json','artifacts/refactor-v2/phase5-source-resolved-proposals.json','artifacts/refactor-v2/phase5-source-review-summary.json','artifacts/refactor-v2/phase4-identity-resolution-map.json'];
const immutableHashes=Object.fromEntries(immutablePaths.map(file=>[file,hash(file)]));
const decisionsFile=readJson('artifacts/refactor-v2/phase5-user-decisions-final.json');
readJson('artifacts/refactor-v2/phase5-worklog-decision-map.json');
const sourceResultsFile=readJson('artifacts/refactor-v2/phase5-source-trace-review-results.json');
readJson('artifacts/refactor-v2/phase5-source-resolved-proposals.json');
const sourceSummary=readJson('artifacts/refactor-v2/phase5-source-review-summary.json');
readJson('artifacts/refactor-v2/phase4-identity-resolution-map.json');
const cross=readCsv('artifacts/refactor-v2/phase5-worklog-crosswalk.csv');
const productionLedger=readCsv('artifacts/refactor-v2/phase5-production-only-worklogs.csv');
const canonical=readCsv('data-generated/worklogs_canonical.csv');
const manifest=readJson('data-generated/manifest.json');

assert(manifest.dataset_version==='2026-09-03.v2'&&manifest.source_sha256==='38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327','BLOCKED_CANONICAL_SOURCE_CHANGED');
assert(canonical.length===2338&&cross.length===2338,'BLOCKED_CANONICAL_ACCOUNTING');
assert(decisionsFile.decisions.length===779,'BLOCKED_DECISION_ACCOUNTING');
assert(sourceSummary.review_queue_total===476&&sourceSummary.source_rows_found===476&&sourceSummary.source_rows_missing===0&&sourceSummary.regression_conflicts===0&&sourceSummary.blocking_issues.length===0,'BLOCKED_SOURCE_REVIEW');
assert(sourceSummary.md_custom===4&&sourceSummary.md_canonical_confirmed===1&&sourceSummary.paired_split_confirmed===9&&sourceSummary.multi_field_fully_confirmed===93&&sourceSummary.multi_field_still_review===2,'BLOCKED_SOURCE_RESULT_COUNTS');
assert(sourceSummary.memo_canonical_confirmed===113&&sourceSummary.memo_production_confirmed===95&&sourceSummary.memo_merge_both===24&&sourceSummary.memo_still_review===6&&sourceSummary.deferred_still_defer===9&&sourceSummary.missing_approved_rechecked===53,'BLOCKED_SOURCE_RESULT_COUNTS');

const decisionByCanonical=new Map(), decisionByProduction=new Map();
for(const decision of decisionsFile.decisions){if(decision.canonical_worklog_key)decisionByCanonical.set(decision.canonical_worklog_key,decision);else if(decision.production_worklog_uuid)decisionByProduction.set(decision.production_worklog_uuid,decision)}
const sourceByDecision=new Map(sourceResultsFile.results.map(result=>[result.decision_id,result]));
const canonicalByKey=new Map(canonical.map(row=>[row.canonical_worklog_key,row]));
const pairList=[['P5D-0019','P5D-0318'],['P5D-0072','P5D-0337'],['P5D-0080','P5D-0338'],['P5D-0087','P5D-0342'],['P5D-0103','P5D-0350'],['P5D-0117','P5D-0362'],['P5D-0130','P5D-0366'],['P5D-0132','P5D-0367'],['P5D-0149','P5D-0373']];
const atomicByDecision=new Map();
pairList.forEach((pair,index)=>pair.forEach(id=>atomicByDecision.set(id,`P5SPLIT-${String(index+1).padStart(2,'0')}`)));
const customMdIds=new Set(['P5D-0001','P5D-0002','P5D-0003','P5D-0005']);
const knownDuplicateSpecs=[['2025-10-18','김재형','S006',0.5],['2025-11-20','권용호','S083',1],['2025-11-20','김재형','S063',1],['2025-11-22','김재형','S063',1],['2025-12-23','김재형','S062',1]];
const duplicateKeys=new Set();
for(const [date,worker,site,md] of knownDuplicateSpecs){const rows=canonical.filter(x=>x.date===date&&x.worker_name===worker&&x.site_code===site&&n(x.raw_md)===md);assert(rows.length===2,`BLOCKED_KNOWN_DUPLICATE_${date}`);rows.forEach(x=>duplicateKeys.add(x.canonical_worklog_key))}

function finalAction(decision,sourceResult){
 if(!decision)return 'KEEP_AS_IS';
 if(customMdIds.has(decision.decision_id))return 'USE_CUSTOM_MD_SEMANTICS';
 if(decision.decision_id==='P5D-0055')return 'USE_CANONICAL_MD';
 if(atomicByDecision.has(decision.decision_id))return 'APPLY_CANONICAL_SPLIT_ATOMIC';
 if(decision.classification==='MULTI_FIELD_CORRECTION'&&sourceResult){return sourceResult.recommendation==='USE_CANONICAL_MULTI_FIELD'?'USE_CANONICAL_MULTI_FIELD':'DEFER_REVIEW'}
 if(['MEMO_REVIEW_REQUIRED','MEMO_BUSINESS_DIFFERENCE'].includes(decision.classification)&&sourceResult){
   if(sourceResult.recommendation==='SOURCE_CONFIRMED_CANONICAL_MEMO')return 'USE_CANONICAL_MEMO';
   if(sourceResult.recommendation==='SOURCE_CONFIRMED_PRODUCTION_MEMO')return 'KEEP_PRODUCTION_MEMO';
   if(sourceResult.recommendation==='MERGE_MEMO_PRESERVE_BOTH')return 'MERGE_MEMO_PRESERVE_BOTH';
   return 'DEFER_REVIEW';
 }
 const mapping={USE_CANONICAL_SITE:'USE_CANONICAL_SITE',USE_PRIMARY_SITE_UUID:'USE_PRIMARY_SITE_UUID',USE_CANONICAL_WORKER:'USE_CANONICAL_WORKER',USE_CANONICAL_MD:'USE_CANONICAL_MD',USE_CANONICAL_MULTI_FIELD:'USE_CANONICAL_MULTI_FIELD',INSERT_MISSING_CANDIDATE:'INSERT_MISSING_CONFIRMED',KEEP_PRODUCTION_ONLY:'KEEP_PRODUCTION_ONLY',USE_CANONICAL_MEMO:'USE_CANONICAL_MEMO',KEEP_AS_IS:'KEEP_AS_IS',DEFER_IDENTITY:'DEFER_IDENTITY',REVIEW_REQUIRED:'KEEP_AS_IS'};
 return mapping[decision.user_decision]||'KEEP_AS_IS';
}
function eligibility(action,hasProduction){
 if(action==='PRESERVE_POST_CANONICAL')return 'POST_CANONICAL_PROTECTED';
 if(['DEFER_IDENTITY','DEFER_REVIEW'].includes(action))return 'EXCLUDED_DEFERRED';
 if(action==='INSERT_MISSING_CONFIRMED')return 'DRY_RUN_INSERT_ELIGIBLE';
 if(action==='APPLY_CANONICAL_SPLIT_ATOMIC')return hasProduction?'DRY_RUN_UPDATE_ELIGIBLE':'DRY_RUN_INSERT_ELIGIBLE';
 if(['USE_CANONICAL_SITE','USE_PRIMARY_SITE_UUID','USE_CANONICAL_WORKER','USE_CANONICAL_MD','USE_CUSTOM_MD_SEMANTICS','USE_CANONICAL_MEMO','MERGE_MEMO_PRESERVE_BOTH','USE_CANONICAL_MULTI_FIELD'].includes(action))return 'DRY_RUN_UPDATE_ELIGIBLE';
 return 'NO_WRITE_KEEP';
}
function targetFor(row,worklog,action){
 const target={date:worklog.date,site_code:worklog.site_code,site_uuid:row.future_target_site_uuid||'',worker:worklog.worker_name,raw_md:n(worklog.raw_md),countable_md:n(worklog.countable_md),labor_amount:n(worklog.labor_amount),countable_labor_amount:n(worklog.countable_labor_amount),entry_type:worklog.entry_type,cost_scope:worklog.cost_scope,memo:worklog.note};
 if(action==='USE_CUSTOM_MD_SEMANTICS'){target.raw_md=1;target.countable_md=0;target.countable_labor_amount=0;target.custom_semantics='RAW_ACTIVITY_PRESERVED_COUNTABLE_EXCLUDED';}
 if(action==='KEEP_PRODUCTION_MEMO')target.memo=row.production_memo;
 if(action==='MERGE_MEMO_PRESERVE_BOTH'){target.memo=null;target.memo_merge={strategy:'SEMANTIC_DEDUP_REQUIRES_DRY_RUN_RENDER',canonical:worklog.note,production:row.production_memo,preserve_both_in_audit:true}}
 return target;
}

const resolutions=[];
for(const row of cross){
 const worklog=canonicalByKey.get(row.canonical_worklog_key),decision=decisionByCanonical.get(row.canonical_worklog_key),sourceResult=decision?sourceByDecision.get(decision.decision_id):null;
 const action=finalAction(decision,sourceResult),flags=[];
 if(duplicateKeys.has(row.canonical_worklog_key))flags.push('KNOWN_VALID_DUPLICATE','NO_DEDUP_DELETE');
 if(['S067','S068'].includes(row.canonical_site_code))flags.push('YEOSU_SEPARATE_BUSINESS_IDENTITY');
 if(action==='USE_CUSTOM_MD_SEMANTICS')flags.push('RAW_COUNTABLE_SEPARATE','NO_LEGACY_MD_WRITE','HISTORICAL_LABOR_PRESERVED');
 if(action==='APPLY_CANONICAL_SPLIT_ATOMIC')flags.push('ATOMIC_PAIR_REQUIRED','NO_PARTIAL_APPLY');
 if(worklog.entry_type==='OTHER'||worklog.entry_type==='HOLIDAY')flags.push('SPECIAL_ENTRY_SEMANTICS');
 resolutions.push({resolution_scope:'CANONICAL_WORKLOG',decision_id:decision?.decision_id||`BASELINE-${row.canonical_worklog_key}`,canonical_worklog_key:row.canonical_worklog_key,production_worklog_uuid:row.production_worklog_uuid,final_action:action,current:{date:row.production_date,site_uuid:row.production_site_uuid,site_name:row.production_site_name,worker_uuid:row.production_worker_uuid,worker_name:row.production_worker_name,md:n(row.production_md),memo:row.production_memo},target:targetFor(row,worklog,action),source_fingerprint:worklog.source_fingerprint,source_review_classification:sourceResult?.source_review_classification||'NOT_IN_SOURCE_REVIEW_QUEUE',reason:sourceResult?.reason||decision?.user_note||decision?.evidence||row.matching_basis,confidence:sourceResult?.confidence||decision?.confidence||row.confidence||'HIGH',migration_eligibility:eligibility(action,Boolean(row.production_worklog_uuid)),atomic_group_id:atomicByDecision.get(decision?.decision_id)||'',protected_flags:flags});
}
for(const row of productionLedger){
 const post=row.is_post_canonical==='true',decision=decisionByProduction.get(row.production_worklog_uuid),action=post?'PRESERVE_POST_CANONICAL':row.classification==='PRODUCTION_ONLY'?'KEEP_PRODUCTION_ONLY':'KEEP_AS_IS';
 resolutions.push({resolution_scope:post?'POST_CANONICAL_PRODUCTION':'UNCLAIMED_PRE_CUTOFF_PRODUCTION',decision_id:decision?.decision_id||`PRODUCTION-${row.production_worklog_uuid}`,canonical_worklog_key:'',production_worklog_uuid:row.production_worklog_uuid,final_action:action,current:{date:row.date,site_uuid:row.site_uuid,site_name:row.site_name,worker_uuid:row.worker_uuid,worker_name:row.worker_name,md:n(row.md),memo:row.memo},target:null,source_fingerprint:'',source_review_classification:'NOT_APPLICABLE',reason:post?'Created after Canonical cutoff; preserve unconditionally':row.reason,confidence:'HIGH',migration_eligibility:eligibility(action,true),atomic_group_id:'',protected_flags:post?['POST_CANONICAL','NO_TOUCH']:['PRODUCTION_RETENTION','NO_DELETE']});
}

const allowedActions=new Set(['KEEP_AS_IS','USE_CANONICAL_SITE','USE_PRIMARY_SITE_UUID','USE_CANONICAL_WORKER','USE_CANONICAL_MD','USE_CUSTOM_MD_SEMANTICS','USE_CANONICAL_MEMO','KEEP_PRODUCTION_MEMO','MERGE_MEMO_PRESERVE_BOTH','USE_CANONICAL_MULTI_FIELD','APPLY_CANONICAL_SPLIT_ATOMIC','INSERT_MISSING_CONFIRMED','KEEP_PRODUCTION_ONLY','PRESERVE_POST_CANONICAL','DEFER_IDENTITY','DEFER_REVIEW']);
assert(resolutions.every(x=>allowedActions.has(x.final_action)),'BLOCKED_FINAL_ACTION_VOCABULARY');
assert(resolutions.filter(x=>x.resolution_scope==='CANONICAL_WORKLOG').length===2338,'BLOCKED_CANONICAL_FINAL_ACCOUNTING');
assert(resolutions.filter(x=>x.resolution_scope==='POST_CANONICAL_PRODUCTION').length===4,'BLOCKED_POST_CANONICAL');
const productionClaims=resolutions.filter(x=>x.resolution_scope==='CANONICAL_WORKLOG'&&x.production_worklog_uuid);
assert(new Set(productionClaims.map(x=>x.production_worklog_uuid)).size===productionClaims.length,'BLOCKED_DOUBLE_CLAIM');
const productionAccounted=new Set(resolutions.map(x=>x.production_worklog_uuid).filter(Boolean));
assert(productionAccounted.size===2260,'BLOCKED_PRODUCTION_ACCOUNTING');
for(const [materialId,missingId] of pairList){const pair=resolutions.filter(x=>[materialId,missingId].includes(x.decision_id));assert(pair.length===2&&pair.every(x=>x.final_action==='APPLY_CANONICAL_SPLIT_ATOMIC')&&new Set(pair.map(x=>x.atomic_group_id)).size===1,'BLOCKED_ATOMIC_SPLIT');const sourcePair=sourceResultsFile.pair_reviews.find(x=>x.pair.includes(materialId));assert(sourcePair?.recommendation==='SOURCE_CONFIRMED_CANONICAL_SPLIT','BLOCKED_ATOMIC_SPLIT_SOURCE')}
const canonicalTargetLabor=resolutions.filter(x=>x.resolution_scope==='CANONICAL_WORKLOG').reduce((sum,x)=>sum+(n(x.target.labor_amount)||0),0);
const canonicalTargetRaw=resolutions.filter(x=>x.resolution_scope==='CANONICAL_WORKLOG').reduce((sum,x)=>sum+(n(x.target.raw_md)||0),0);
const canonicalTargetCountable=resolutions.filter(x=>x.resolution_scope==='CANONICAL_WORKLOG').reduce((sum,x)=>sum+(n(x.target.countable_md)||0),0);
assert(canonicalTargetLabor===manifest.labor_amount,'BLOCKED_COMPANY_LABOR_DRIFT');
assert(canonicalTargetRaw===manifest.raw_md&&canonicalTargetCountable===manifest.countable_md-4,'BLOCKED_CUSTOM_MD_SEMANTICS');

const unresolved=resolutions.filter(x=>x.migration_eligibility==='EXCLUDED_DEFERRED').map(x=>({decision_id:x.decision_id,canonical_worklog_key:x.canonical_worklog_key,production_worklog_uuid:x.production_worklog_uuid,final_action:x.final_action,reason:x.reason,missing_evidence:x.final_action==='DEFER_IDENTITY'?'Approved unique Production identity/contract mapping':x.decision_id.match(/^P5D-0(463|464|503|507|667|668)$/)?'Original XLSX raw memo/MD/site cell content':'Original XLSX evidence for unresolved changed fields',blocking_scope:'ROW_ONLY_NOT_GLOBAL_MIGRATION',future_resolution_requirement:x.final_action==='DEFER_IDENTITY'?'User-approved identity resolution with contract chronology':'Original workbook raw-cell review and explicit user decision'}));
const countAction=action=>resolutions.filter(x=>x.final_action===action).length;
const countEligibility=value=>resolutions.filter(x=>x.migration_eligibility===value).length;
const finalSummary={dataset_version:manifest.dataset_version,source_sha:manifest.source_sha256,canonical_rows_accounted:2338,production_rows_accounted:productionAccounted.size,source_review:'476/476',source_missing:0,regression_conflicts:0,final_resolution_rows:resolutions.length,dry_run_update_eligible:countEligibility('DRY_RUN_UPDATE_ELIGIBLE'),dry_run_insert_eligible:countEligibility('DRY_RUN_INSERT_ELIGIBLE'),no_write_keep:countEligibility('NO_WRITE_KEEP'),excluded_deferred:countEligibility('EXCLUDED_DEFERRED'),post_canonical_protected:countEligibility('POST_CANONICAL_PROTECTED'),custom_md_semantics:countAction('USE_CUSTOM_MD_SEMANTICS'),canonical_md_source_confirmed:resolutions.filter(x=>x.decision_id==='P5D-0055'&&x.final_action==='USE_CANONICAL_MD').length,paired_splits_confirmed:9,multi_field_confirmed:sourceSummary.multi_field_fully_confirmed,multi_field_previously_approved:4,multi_field_total_final_approved:sourceSummary.multi_field_fully_confirmed+4,multi_field_deferred:resolutions.filter(x=>x.final_action==='DEFER_REVIEW'&&decisionByCanonical.get(x.canonical_worklog_key)?.classification==='MULTI_FIELD_CORRECTION').length,memo_canonical:sourceSummary.memo_canonical_confirmed,memo_production:sourceSummary.memo_production_confirmed,memo_merge:sourceSummary.memo_merge_both,memo_deferred:sourceSummary.memo_still_review,identity_deferred_sites:9,identity_deferred_worklogs:resolutions.filter(x=>x.final_action==='DEFER_IDENTITY').length,missing_confirmed:countAction('INSERT_MISSING_CONFIRMED'),production_only_keep:resolutions.filter(x=>x.resolution_scope==='UNCLAIMED_PRE_CUTOFF_PRODUCTION'&&x.final_action==='KEEP_PRODUCTION_ONLY').length,known_duplicates:resolutions.filter(x=>x.protected_flags.includes('KNOWN_VALID_DUPLICATE')).length,canonical_target_raw_md:canonicalTargetRaw,canonical_target_countable_md:canonicalTargetCountable,canonical_target_labor:canonicalTargetLabor,blocking_issues:[]};
assert(finalSummary.custom_md_semantics===4&&finalSummary.canonical_md_source_confirmed===1&&finalSummary.paired_splits_confirmed===9,'BLOCKED_MD_OR_SPLIT_FINAL');
assert(finalSummary.multi_field_confirmed===93&&finalSummary.multi_field_previously_approved===4&&finalSummary.multi_field_total_final_approved===97&&finalSummary.multi_field_deferred===2,'BLOCKED_MULTI_FINAL');
assert(finalSummary.memo_canonical===113&&finalSummary.memo_production===95&&finalSummary.memo_merge===24&&finalSummary.memo_deferred===6,'BLOCKED_MEMO_FINAL');
assert(finalSummary.missing_confirmed===53&&finalSummary.production_only_keep===102&&finalSummary.known_duplicates===10,'BLOCKED_RETENTION_FINAL');
assert(unresolved.length===116&&unresolved.filter(x=>x.final_action==='DEFER_REVIEW').length===8,'BLOCKED_UNRESOLVED_SCOPE');

writeJson('artifacts/refactor-v2/phase5-worklog-final-resolution.json',{dataset_version:manifest.dataset_version,source_sha:manifest.source_sha256,canonical_count:2338,production_count:2260,post_canonical_count:4,immutable_inputs:immutableHashes,resolutions});
writeJson('artifacts/refactor-v2/phase5-worklog-final-unresolved.json',{dataset_version:manifest.dataset_version,unresolved_rows:unresolved.length,multi_field_still_review:2,memo_still_review:6,deferred_identity_worklogs:108,global_migration_blocker:false,rows:unresolved});
writeJson('artifacts/refactor-v2/phase5-worklog-final-summary.json',finalSummary);

const doc=`# Phase 5.4 Worklog Final Resolution

## Decision precedence and scope

The immutable resolution applies exact Phase 5.3 source-trace evidence first, approved Phase 5.2 user decisions second, and the Phase 5 reconciliation classification only as a fallback. Existing decision, source-review, and identity artifacts remain hash-identical. This phase creates a local dry-run input only; no Production write, SQL, migration, application change, or expense reconciliation occurred.

## Final source decisions

Four MD conflicts use custom V2 semantics: raw MD 1, countable MD 0, source historical labor 270,000 each. P5D-0055 uses the source-confirmed Canonical zero values. Existing S098 OTHER decisions retain raw activity, zero countable MD/labor, overhead cost scope, and historical labor without forcing either meaning into the legacy single MD field.

All nine paired splits are explicit atomic groups. Both sides must appear in the same future simulation; partial application is invalid. Phase 5.3 source evidence confirms 93 multi-field decisions; four previously approved split/normalization decisions remain approved, yielding 97 final approvals across all 99 multi-field decisions, with two row-scoped deferred.

For the 238 source-reviewed memos, 113 use Canonical text, 95 retain Production text, 24 require semantic de-duplication while preserving both originals in audit metadata, and six remain deferred because the original XLSX raw cell is unavailable. Automatic string concatenation is prohibited.

## Identity, missing rows, and retention

All nine deferred site identities remain separate and unresolved; their 108 dependent worklogs are excluded from a future write simulation. Y1 monthly/floor/day-night contracts are not merged. Fifty-three missing rows are dry-run insert eligible after source regression checks. Production-only and seven unclaimed review-ledger rows remain no-write retention records; none is a deletion candidate. Four post-canonical rows are NO_TOUCH protected.

All five known duplicate groups and ten Canonical rows carry KNOWN_VALID_DUPLICATE and NO_DEDUP_DELETE flags. S067/S068 rows retain their separate-business-identity flag. Legacy site deletion or supersession is not implied by UUID reassignment eligibility.

## Dry-run gate

DRY_RUN_UPDATE_ELIGIBLE and DRY_RUN_INSERT_ELIGIBLE mean simulation eligibility only, not database authorization. The unresolved file contains exactly the two multi-field rows, six memo rows, and 108 identity-dependent rows that remain excluded. The next permitted phase may simulate the final plan without SQL or writes; actual Production mutation requires a later explicit gate.
`;
writeText('docs/refactor-v2/16_WORKLOG_FINAL_RESOLUTION.md',doc);
for(const [file,before] of Object.entries(immutableHashes))assert(hash(file)===before,`BLOCKED_IMMUTABLE_INPUT_CHANGED:${file}`);
console.log(JSON.stringify(finalSummary,null,2));
