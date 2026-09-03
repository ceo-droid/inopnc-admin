import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

const root=process.cwd(), outDir=path.join(root,'artifacts','refactor-v2');
const expected={version:'2026-09-03.v2',sha:'38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327',count:2338,raw:2281,countable:2200,labor:663620000,countableLabor:630005000,overhead:33615000};
const readJson=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const readCsv=f=>Papa.parse(fs.readFileSync(path.join(root,f),'utf8'),{header:true,skipEmptyLines:true}).data;
const writeCsv=(f,rows,fields)=>fs.writeFileSync(path.join(outDir,f),Papa.unparse(rows,{columns:fields,newline:'\n'})+'\n');
const hashFile=f=>crypto.hash('sha256',fs.readFileSync(path.join(root,f)),'hex');
const num=v=>v===''||v==null?null:Number(v);
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const tokens=s=>new Set(String(s??'').normalize('NFKC').toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter(x=>x.length>1));
const similarity=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size&&!B.size)return 1;if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i)};
const key=(...xs)=>xs.map(x=>String(x??'')).join('\u001f');
const range=rows=>rows.length?`${rows.map(x=>x.date).sort()[0]}..${rows.map(x=>x.date).sort().at(-1)}`:'';
const freq=(rows,getter)=>[...rows.reduce((m,r)=>{const x=getter(r)||'(blank)';m.set(x,(m.get(x)||0)+1);return m},new Map())].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8).map(([x,n])=>`${x}:${n}`).join(' | ');
const themes=rows=>freq(rows,r=>String(r.note??'').trim().slice(0,60));

const manifest=readJson('data-generated/manifest.json');
const canonical=readCsv('data-generated/worklogs_canonical.csv');
const sitesCanonical=readCsv('data-generated/sites_canonical.csv');
readCsv('data-generated/review_required.csv');
const resolution=readJson('artifacts/refactor-v2/phase4-identity-resolution-map.json');
const siteCrosswalk=readCsv('artifacts/refactor-v2/phase4-site-crosswalk.csv');
const workerCrosswalk=readCsv('artifacts/refactor-v2/phase4-worker-crosswalk.csv');
const decisions=readCsv('artifacts/refactor-v2/phase4-user-decisions-final.csv');
const blocking=[];
if(manifest.dataset_version!==expected.version||manifest.source_sha256!==expected.sha||manifest.worklogs!==expected.count||canonical.length!==expected.count) blocking.push('BLOCKED_CANONICAL_CHANGED');
for(const [f,h] of Object.entries(manifest.output_hashes||{})){if(['worklogs_canonical.csv','sites_canonical.csv','review_required.csv'].includes(f)&&hashFile(`data-generated/${f}`)!==h)blocking.push(`BLOCKED_HASH_${f}`)}
const totals={raw:canonical.reduce((s,r)=>s+num(r.raw_md),0),countable:canonical.reduce((s,r)=>s+num(r.countable_md),0),labor:canonical.reduce((s,r)=>s+(num(r.labor_amount)||0),0),countableLabor:canonical.reduce((s,r)=>s+(num(r.countable_labor_amount)||0),0),overhead:canonical.filter(r=>r.cost_scope==='overhead').reduce((s,r)=>s+(num(r.labor_amount)||0),0)};
if(totals.raw!==expected.raw||totals.countable!==expected.countable||totals.labor!==expected.labor||totals.countableLabor!==expected.countableLabor||totals.overhead!==expected.overhead)blocking.push('BLOCKED_CANONICAL_TOTAL_CHANGED');
const holidays=canonical.filter(r=>r.site_code==='S107'&&r.entry_type==='HOLIDAY'), others=canonical.filter(r=>r.site_code==='S098'&&r.entry_type==='OTHER');
if(holidays.length!==147||holidays.some(r=>num(r.countable_md)!==0)||others.length!==84||others.reduce((s,r)=>s+num(r.raw_md),0)!==81||others.reduce((s,r)=>s+(num(r.labor_amount)||0),0)!==expected.overhead||others.some(r=>num(r.countable_md)!==0||num(r.countable_labor_amount)!==0))blocking.push('BLOCKED_SPECIAL_ENTRY_SEMANTICS');
if(blocking.length)throw new Error(blocking.join(', '));

const url=process.env.VITE_SUPABASE_URL, publishable=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!publishable)throw new Error('Missing read-only Supabase environment');
const db=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
async function readAll(table,columns){const {count,error:countError}=await db.from(table).select('id',{count:'exact',head:true});if(countError)throw countError;const rows=[];for(let start=0;start<(count||0);start+=1000){const {data,error}=await db.from(table).select(columns).range(start,Math.min(start+999,count-1));if(error)throw error;rows.push(...data)}if(rows.length!==count)throw new Error(`Pagination count mismatch: ${table}`);return {count,rows}}
const [prodLogsResult,prodSitesResult,prodWorkersResult]=await Promise.all([readAll('work_logs','id,date,site_id,worker_id,md,note,created_at'),readAll('sites','id,name,company_name,budget,status'),readAll('workers','id,name,daily')]);
const prodLogs=prodLogsResult.rows, prodSites=prodSitesResult.rows, prodWorkers=prodWorkersResult.rows;
if(prodLogs.length<2260)blocking.push('BLOCKED_UNEXPECTED_ROW_LOSS');
const siteById=new Map(prodSites.map(x=>[x.id,x])), workerById=new Map(prodWorkers.map(x=>[x.id,x]));

const deferredCodes=new Set(['S111','S130','S150','S151','S152','S153','S154','S155','S168']);
const canonicalOnlyCodes=new Set(decisions.filter(r=>r.entity_type==='SITE'&&r.user_decision==='KEEP_CANONICAL_ONLY').map(r=>r.canonical_identity.split(':')[0]));
let siteIds=new Map();
for(const r of siteCrosswalk)if(['EXACT','AUTO_SAFE_LINK'].includes(r.classification)&&r.production_site_uuid)siteIds.set(r.canonical_site_code,new Set([r.production_site_uuid]));
for(const [code,id] of Object.entries(resolution.primary_links.sites||{}))siteIds.set(code,new Set([id]));
for(const [code,ids] of Object.entries(resolution.legacy_components||{})){if(!siteIds.has(code))siteIds.set(code,new Set());for(const id of ids)siteIds.get(code).add(id)}
siteIds=new Map([...siteIds].filter(([c])=>!deferredCodes.has(c)&&!canonicalOnlyCodes.has(c)||(resolution.primary_links.sites||{})[c]));
const primarySite=new Map(Object.entries(resolution.primary_links.sites||{}));
for(const r of siteCrosswalk)if(['EXACT','AUTO_SAFE_LINK'].includes(r.classification)&&!primarySite.has(r.canonical_site_code))primarySite.set(r.canonical_site_code,r.production_site_uuid);
const workerIds=new Map();
for(const r of workerCrosswalk)if(r.classification==='EXACT'&&r.production_worker_uuid&&r.canonical_worker_name!=='1톤스카이')workerIds.set(r.canonical_worker_name,r.production_worker_uuid);
for(const [name,id] of Object.entries(resolution.primary_links.workers||{}))if(name!=='임지만'&&name!=='1톤스카이')workerIds.set(name,id);

const cutoff='2026-08-31', post=prodLogs.filter(r=>r.date>cutoff), pre=prodLogs.filter(r=>r.date<=cutoff);
const claimed=new Map(), cross=[];
const candidates=(c,mode='all')=>pre.filter(p=>!claimed.has(p.id)&&(mode==='all'||p[mode.field]===mode.value));
function allowedSite(c,p){return siteIds.get(c.site_code)?.has(p.site_id)||false}
function sameMd(c,p){return num(c.raw_md)===num(p.md)}
function exactPool(c){const wid=workerIds.get(c.worker_name);return candidates(c).filter(p=>p.date===c.date&&p.worker_id===wid&&allowedSite(c,p)&&sameMd(c,p))}
function chooseCorrection(c){const wid=workerIds.get(c.worker_name), sid=siteIds.get(c.site_code)||new Set();const specs=[
  ['CORRECTION_SITE',p=>p.date===c.date&&p.worker_id===wid&&sameMd(c,p)&&norm(p.note)===norm(c.note)],
  ['CORRECTION_WORKER',p=>p.date===c.date&&sid.has(p.site_id)&&sameMd(c,p)&&norm(p.note)===norm(c.note)],
  ['CORRECTION_MD',p=>p.date===c.date&&p.worker_id===wid&&sid.has(p.site_id)&&norm(p.note)===norm(c.note)],
  ['CORRECTION_MEMO',p=>p.date===c.date&&p.worker_id===wid&&sid.has(p.site_id)&&sameMd(c,p)]
];
for(const [classification,test] of specs){const a=candidates(c).filter(test);if(a.length===1)return {p:a[0],classification,confidence:classification==='CORRECTION_MEMO'?'MEDIUM':'HIGH'};if(a.length>1)return {classification:'REVIEW_REQUIRED',reason:`multiple ${classification} candidates: ${a.map(x=>x.id).join('|')}`}}
const broad=candidates(c).filter(p=>p.date===c.date&&(p.worker_id===wid||sid.has(p.site_id)));if(broad.length===1)return {p:broad[0],classification:'MULTI_FIELD_CORRECTION',confidence:'LOW'};if(broad.length>1)return {classification:'REVIEW_REQUIRED',reason:`multiple broad candidates: ${broad.map(x=>x.id).join('|')}`};return null}
function emit(c,p,classification,confidence,basis,reason=''){
 const dif=[];if(p){if(p.date!==c.date)dif.push('date');if(!allowedSite(c,p))dif.push('site');if(p.worker_id!==workerIds.get(c.worker_name))dif.push('worker');if(!sameMd(c,p))dif.push('md');if(norm(p.note)!==norm(c.note))dif.push('memo')}
 cross.push({canonical_worklog_key:c.canonical_worklog_key,canonical_source_fingerprint:c.source_fingerprint,source_workbook:manifest.source_filename,source_sheet:c.source_sheet,source_excel_row:c.source_excel_row,canonical_date:c.date,canonical_site_code:c.site_code,canonical_site_name:c.site_name,canonical_worker:c.worker_name,canonical_raw_md:c.raw_md,canonical_countable_md:c.countable_md,canonical_entry_type:c.entry_type,canonical_cost_scope:c.cost_scope,canonical_labor_amount:c.labor_amount,canonical_memo:c.note,production_worklog_uuid:p?.id||'',production_date:p?.date||'',production_site_uuid:p?.site_id||'',production_site_name:p?siteById.get(p.site_id)?.name||'':'',production_worker_uuid:p?.worker_id||'',production_worker_name:p?workerById.get(p.worker_id)?.name||'':'',production_md:p?.md??'',production_memo:p?.note??'',classification,confidence,matching_basis:basis,field_differences:dif.join('|'),future_target_site_uuid:primarySite.get(c.site_code)||'',review_reason:reason,post_canonical:'false'});
 if(p)claimed.set(p.id,c.canonical_worklog_key)
}
for(const c of canonical){
 if(!siteIds.has(c.site_code)||!workerIds.has(c.worker_name)){const special=c.worker_name==='임지만'?'CANONICAL_ONLY_UNRESOLVED_WORKER':deferredCodes.has(c.site_code)?'DEFERRED_SITE_IDENTITY':'UNRESOLVED_SITE_OR_WORKER';emit(c,null,'UNRESOLVED_IDENTITY','HIGH','Phase4 identity resolution unavailable',special);continue}
 const pool=exactPool(c), exact=pool.filter(p=>norm(p.note)===norm(c.note));
 if(exact.length===1){emit(c,exact[0],'EXACT_MATCH','HIGH','date + resolved site/worker UUID + raw MD + normalized memo');continue}
 if(exact.length>1){emit(c,null,'REVIEW_REQUIRED','LOW','candidate lookup only',`REVIEW_REQUIRED_CARDINALITY: ${exact.map(x=>x.id).join('|')}`);continue}
 if(pool.length===1){const sim=similarity(pool[0].note,c.note);if(sim>=0.72){emit(c,pool[0],'SAFE_MATCH','MEDIUM',`unique business row; memo token similarity ${sim.toFixed(2)}`);continue}}
 if(pool.length>1){emit(c,null,'REVIEW_REQUIRED','LOW','candidate lookup only',`REVIEW_REQUIRED_CARDINALITY: ${pool.map(x=>x.id).join('|')}`);continue}
 const correction=chooseCorrection(c);if(correction?.p){emit(c,correction.p,correction.classification,correction.confidence,'unique same-event correction candidate');continue}if(correction){emit(c,null,correction.classification,'LOW','candidate lookup only',correction.reason);continue}
 emit(c,null,'CANONICAL_ONLY','MEDIUM','no unclaimed Production candidate under approved identities');
}

if(cross.length!==canonical.length)blocking.push('BLOCKED_CANONICAL_ACCOUNTING');
if(new Set(cross.map(x=>x.canonical_worklog_key)).size!==canonical.length)blocking.push('BLOCKED_CANONICAL_DUPLICATION');
if(new Set([...claimed.keys()]).size!==claimed.size)blocking.push('BLOCKED_PRODUCTION_DOUBLE_CLAIM');
const unclaimedPre=pre.filter(p=>!claimed.has(p.id));
const ambiguousIds=new Set(cross.filter(x=>x.classification==='REVIEW_REQUIRED').flatMap(x=>x.review_reason.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)||[]));
const productionOnly=[...unclaimedPre.map(p=>({production_worklog_uuid:p.id,date:p.date,site_uuid:p.site_id,site_name:siteById.get(p.site_id)?.name||'',worker_uuid:p.worker_id,worker_name:workerById.get(p.worker_id)?.name||'',md:p.md,memo:p.note??'',classification:ambiguousIds.has(p.id)?'REVIEW_REQUIRED':'PRODUCTION_ONLY',reason:ambiguousIds.has(p.id)?'Candidate in a cardinality/ambiguity review; not claimed':'No unique canonical claim; preserve for user review',is_post_canonical:'false'})),...post.map(p=>({production_worklog_uuid:p.id,date:p.date,site_uuid:p.site_id,site_name:siteById.get(p.site_id)?.name||'',worker_uuid:p.worker_id,worker_name:workerById.get(p.worker_id)?.name||'',md:p.md,memo:p.note??'',classification:'POST_CANONICAL',reason:'Created after canonical cutoff; preserve unconditionally',is_post_canonical:'true'}))];

const correctionRows=cross.filter(x=>x.classification.startsWith('CORRECTION_')||x.classification==='MULTI_FIELD_CORRECTION').map(x=>({production_worklog_uuid:x.production_worklog_uuid,canonical_worklog_key:x.canonical_worklog_key,current_values:JSON.stringify({date:x.production_date,site_uuid:x.production_site_uuid,worker_uuid:x.production_worker_uuid,md:x.production_md,memo:x.production_memo}),expected_canonical_values:JSON.stringify({date:x.canonical_date,site_code:x.canonical_site_code,target_site_uuid:x.future_target_site_uuid,worker:x.canonical_worker,md:x.canonical_raw_md,memo:x.canonical_memo,entry_type:x.canonical_entry_type}),difference_fields:x.field_differences,future_action_suggestion:'USER_REVIEW_ONLY',evidence:x.matching_basis}));
const reviewRows=cross.filter(x=>['REVIEW_REQUIRED','UNRESOLVED_IDENTITY'].includes(x.classification)).map(x=>({canonical_worklog_key:x.canonical_worklog_key,canonical_date:x.canonical_date,canonical_site_code:x.canonical_site_code,canonical_worker:x.canonical_worker,canonical_raw_md:x.canonical_raw_md,production_candidate_uuid:x.production_worklog_uuid,classification:x.classification,review_reason:x.review_reason,evidence:x.matching_basis,user_decision:''}));

const deferredEvidence=[];
for(const code of deferredCodes){const crows=canonical.filter(x=>x.site_code===code), decision=decisions.find(x=>x.entity_type==='SITE'&&x.canonical_identity.startsWith(`${code}:`));const text=[decision?.production_candidate_uuid,decision?.other_candidates_evidence].filter(Boolean).join(' ');const ids=[...new Set(text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)||[])];const candidateIds=ids.length?ids:[''];for(const id of candidateIds){const prows=id?prodLogs.filter(x=>x.site_id===id&&x.date<=cutoff):[];const overlap=prows.filter(p=>crows.some(c=>c.date===p.date&&workerIds.get(c.worker_name)===p.worker_id)).length;const recommendation=!id?'PROPOSE_CANONICAL_ONLY':'STILL_DEFER';deferredEvidence.push({site_code:code,canonical_count:crows.length,canonical_date_range:range(crows),canonical_workers:freq(crows,x=>x.worker_name),canonical_themes:themes(crows),production_candidate_uuid:id,production_candidate_name:id?siteById.get(id)?.name||'':'',production_count:prows.length,production_date_range:range(prows),production_workers:freq(prows,x=>workerById.get(x.worker_id)?.name||x.worker_id),production_themes:themes(prows),recommendation,confidence:id?'LOW':'MEDIUM',reason:id?`Chronology retained for review; same-date/resolved-worker overlaps=${overlap}; name alone is insufficient`:'No approved or identified Production candidate',user_decision:''})}}

const countClass=c=>cross.filter(x=>x.classification===c).length;
const known=[['2025-10-18','김재형','S006','0.5'],['2025-11-20','권용호','S083','1'],['2025-11-20','김재형','S063','1'],['2025-11-22','김재형','S063','1'],['2025-12-23','김재형','S062','1']];
const dupRows=known.reduce((n,[d,w,s,m])=>n+cross.filter(x=>x.canonical_date===d&&x.canonical_worker===w&&x.canonical_site_code===s&&Number(x.canonical_raw_md)===Number(m)).length,0);
if(dupRows!==10)blocking.push('BLOCKED_DUPLICATE_PROTECTION');
if(post.some(p=>!productionOnly.some(x=>x.production_worklog_uuid===p.id&&x.classification==='POST_CANONICAL')))blocking.push('BLOCKED_POST_CANONICAL_OMITTED');
const summary={dataset_version:manifest.dataset_version,source_sha256:manifest.source_sha256,production_current_count:prodLogs.length,production_pre_cutoff_count:pre.length,post_canonical_count:post.length,canonical_count:canonical.length,exact_match:countClass('EXACT_MATCH'),safe_match:countClass('SAFE_MATCH'),site_corrections:countClass('CORRECTION_SITE'),worker_corrections:countClass('CORRECTION_WORKER'),md_corrections:countClass('CORRECTION_MD'),memo_corrections:countClass('CORRECTION_MEMO'),entry_type_corrections:countClass('CORRECTION_ENTRY_TYPE'),multi_field_corrections:countClass('MULTI_FIELD_CORRECTION'),canonical_only:countClass('CANONICAL_ONLY'),production_only_pre_cutoff:unclaimedPre.filter(x=>!ambiguousIds.has(x.id)).length,production_review_required_pre_cutoff:unclaimedPre.filter(x=>ambiguousIds.has(x.id)).length,review_required:countClass('REVIEW_REQUIRED'),unresolved_identity:countClass('UNRESOLVED_IDENTITY'),duplicate_candidate_groups_protected:dupRows===10?5:0,duplicate_candidate_rows_protected:dupRows,raw_md_total:totals.raw,countable_md_total:totals.countable,labor_total:totals.labor,countable_labor_total:totals.countableLabor,other_overhead_labor:totals.overhead,holiday_rows:holidays.length,other_rows:others.length,post_canonical_ids:post.map(x=>x.id).sort(),deferred_identities_reviewed:deferredCodes.size,deferred_propose_link:deferredEvidence.filter(x=>x.recommendation==='PROPOSE_LINK').length,deferred_still_defer:new Set(deferredEvidence.filter(x=>x.recommendation==='STILL_DEFER').map(x=>x.site_code)).size,deferred_propose_canonical_only:new Set(deferredEvidence.filter(x=>x.recommendation==='PROPOSE_CANONICAL_ONLY').map(x=>x.site_code)).size,company_total_change:0,blocking_issues:blocking};

const crossFields=['canonical_worklog_key','canonical_source_fingerprint','source_workbook','source_sheet','source_excel_row','canonical_date','canonical_site_code','canonical_site_name','canonical_worker','canonical_raw_md','canonical_countable_md','canonical_entry_type','canonical_cost_scope','canonical_labor_amount','canonical_memo','production_worklog_uuid','production_date','production_site_uuid','production_site_name','production_worker_uuid','production_worker_name','production_md','production_memo','classification','confidence','matching_basis','field_differences','future_target_site_uuid','review_reason','post_canonical'];
writeCsv('phase5-worklog-crosswalk.csv',cross,crossFields);
writeCsv('phase5-production-only-worklogs.csv',productionOnly,['production_worklog_uuid','date','site_uuid','site_name','worker_uuid','worker_name','md','memo','classification','reason','is_post_canonical']);
writeCsv('phase5-worklog-corrections.csv',correctionRows,['production_worklog_uuid','canonical_worklog_key','current_values','expected_canonical_values','difference_fields','future_action_suggestion','evidence']);
writeCsv('phase5-worklog-review.csv',reviewRows,['canonical_worklog_key','canonical_date','canonical_site_code','canonical_worker','canonical_raw_md','production_candidate_uuid','classification','review_reason','evidence','user_decision']);
writeCsv('phase5-deferred-identity-evidence.csv',deferredEvidence,['site_code','canonical_count','canonical_date_range','canonical_workers','canonical_themes','production_candidate_uuid','production_candidate_name','production_count','production_date_range','production_workers','production_themes','recommendation','confidence','reason','user_decision']);
fs.writeFileSync(path.join(outDir,'phase5-worklog-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
