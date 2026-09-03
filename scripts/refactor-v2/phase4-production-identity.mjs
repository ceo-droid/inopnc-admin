import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

const root=resolve(import.meta.dirname,'..','..');
const generated=resolve(root,'data-generated');
const out=resolve(root,'artifacts','refactor-v2');
const expectedVersion='2026-09-03.v2';
const expectedSha='38e602b1e6c17e6af4931e019890738ef10e71001f15dfb86fa9aa1b8a64f327';
const manifest=JSON.parse(readFileSync(resolve(generated,'manifest.json'),'utf8'));
if(manifest.dataset_version!==expectedVersion||manifest.source_sha256!==expectedSha||manifest.sites!==138) throw new Error('BLOCKED_CANONICAL_CHANGED');
for(const [name,hash] of Object.entries(manifest.output_hashes)) if(name.endsWith('.csv')) {
  const actual=createHash('sha256').update(readFileSync(resolve(generated,name))).digest('hex');
  if(actual!==hash) throw new Error(`BLOCKED_CANONICAL_CHANGED:${name}`);
}
const csv=(name)=>Papa.parse(readFileSync(resolve(generated,name),'utf8'),{header:true,skipEmptyLines:true}).data;
const canonicalSites=csv('sites_canonical.csv');
const logs=csv('worklogs_canonical.csv');
const expenses=csv('expenses_canonical.csv');
csv('review_required.csv'); csv('source_trace.csv');
if(canonicalSites.length!==138||logs.length!==2338||expenses.length!==4885) throw new Error('BLOCKED_CANONICAL_CHANGED:counts');

const url=process.env.VITE_SUPABASE_URL; const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY;
if(!url||!key) throw new Error('Safe Supabase read environment is missing');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function all(table,columns){
 const {count,error:ce}=await db.from(table).select('id',{count:'exact',head:true}); if(ce) throw ce;
 const rows=[]; for(let from=0;from<(count||0);from+=1000){const {data,error}=await db.from(table).select(columns).range(from,Math.min(from+999,count-1));if(error)throw error;rows.push(...data)}
 return {rows,count:count||0};
}
const [pc,ps,pw,pl,pt,pch]=await Promise.all([all('customers','id,name,contact,created_at'),all('sites','id,name,company_name,budget,status,created_at'),all('workers','id,name,daily,created_at'),all('work_logs','id,date,site_id,worker_id'),all('transactions','id,date,site_id'),all('checklists','id,date')]);

const n=(v)=>String(v??'').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|㈜/g,'').replace(/[^0-9a-z가-힣]/g,'');
const literalKey=(v)=>String(v??'').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g,'');
const grams=(v)=>{const s=n(v),r=new Set();for(let i=0;i<Math.max(1,s.length-1);i++)r.add(s.slice(i,i+2));return r};
const sim=(a,b)=>{const x=grams(a),y=grams(b);let z=0;for(const q of x)if(y.has(q))z++;return (2*z)/(x.size+y.size||1)};
const custEquivalent=(a,b)=>n(a)===n(b)||(n(a)==='삼표피앤씨'&&n(b)==='삼표피앤씨');
const protectedGroups={S017:'SONGDO',S091:'SONGDO',S064:'DAEJEON',S147:'DAEJEON',S065:'DAEJO',S132:'DAEJO',S067:'YEOSU',S068:'YEOSU',S090:'ASAN',S106:'ASAN',S111:'YONGIN_FAB',S150:'YONGIN_FAB',S148:'INCHEON_AA19',S167:'INCHEON_AA19'};
const amountState=(c,p)=>c===''?'CANONICAL_NULL':Number(p||0)===0?'PRODUCTION_NULL_OR_ZERO':Number(c)===Number(p)?'EXACT_AMOUNT':'DIFFERENT_AMOUNT';
const claimed=new Map(); const reviews=[]; let reviewSeq=0;
const addReview=(entity,canonical,candidates,evidence,risk,decision)=>reviews.push({review_id:`P4-${String(++reviewSeq).padStart(4,'0')}`,entity_type:entity,canonical_identity:canonical,production_candidate_uuid:candidates[0]?.id||'',production_candidate_label:candidates[0]?.name||'',other_candidates:candidates.slice(1).map(x=>`${x.id}:${x.name}`).join(' | '),evidence,risk,recommended_decision:decision,user_decision:'',user_note:''});

const siteRows=[]; const usedSites=new Set();
for(const c of canonicalSites){
 const ranked=ps.rows.map(p=>{let score=sim(c.site_name,p.name);if(c.site_code==='S068'&&/내민|발코니|확공/.test(p.name))score+=.6;if(c.site_code==='S067'&&/여수.*죽림/.test(p.name)&&!/내민|발코니|확공/.test(p.name))score+=.35;return {p,score,amount:Number(c.contract_supply_amount||0)===Number(p.budget||0),customer:custEquivalent(c.operational_customer_name,p.company_name)}}).sort((a,b)=>Number(b.amount&&b.customer)-Number(a.amount&&a.customer)||b.score-a.score);
 const candidates=ranked.filter(x=>x.score>=.48||(x.amount&&x.customer&&x.score>=.28)); const best=candidates[0]; let classification='CANONICAL_ONLY',confidence='0',basis='no credible Production candidate',action='KEEP_CANONICAL_ONLY',reason='';
 if(best){
  const exactName=n(c.site_name)===n(best.p.name); const decisive=best.amount&&best.customer&&(exactName||best.score>=.58)&&(!candidates[1]||!(candidates[1].amount&&candidates[1].customer&&Math.abs(candidates[1].score-best.score)<.08));
  if(protectedGroups[c.site_code]){classification='DUPLICATE_NAME_SEPARATE_CONTRACT';confidence=decisive?'HIGH':'MEDIUM';basis=`protected ${protectedGroups[c.site_code]}; ${best.amount?'amount agrees':'amount differs'}; customer ${best.customer?'agrees':'differs'}; name score ${best.score.toFixed(2)}`;action=decisive?'LINK_AFTER_USER_REVIEW':'DEFER';reason='Separate-contract rule fixed; UUID linkage requires review';}
  else if(exactName&&best.customer&&best.amount){classification='EXACT';confidence='HIGH';basis='normalized display name + customer + contract amount';action='LINK';}
  else if(decisive){classification='AUTO_SAFE_LINK';confidence='HIGH';basis=`single candidate supported by customer + amount + name context (${best.score.toFixed(2)})`;action='LINK';}
  else {classification='REVIEW_REQUIRED';confidence='LOW';basis=`candidate ranking only (${best.score.toFixed(2)})`;action='DEFER';reason='Insufficient multi-evidence identity proof';}
  if(classification!=='CANONICAL_ONLY'){usedSites.add(best.p.id); if(['EXACT','AUTO_SAFE_LINK'].includes(classification)){if(claimed.has(best.p.id))reason=`duplicate UUID claim with ${claimed.get(best.p.id)}`;else claimed.set(best.p.id,c.site_code);}}
  if(['REVIEW_REQUIRED','DUPLICATE_NAME_SEPARATE_CONTRACT'].includes(classification)) addReview('SITE',`${c.site_code}:${c.site_name}`,candidates.slice(0,5).map(x=>x.p),basis,'HIGH',decisive?'LINK':'DEFER');
 }
 const p=best?.p||{}; siteRows.push({canonical_site_code:c.site_code,canonical_site_name:c.site_name,canonical_operational_customer:c.operational_customer_name,canonical_contract_supply_amount:c.contract_supply_amount,production_site_uuid:p.id||'',production_site_name:p.name||'',production_customer_name:p.company_name||'',production_legacy_budget:p.budget??'',contract_amount_comparison:amountState(c.contract_supply_amount,p.budget),classification,confidence,matching_basis:basis,candidate_count:candidates.length,recommended_action:action,review_reason:reason,protected_same_name_group:protectedGroups[c.site_code]||''});
}
for(const p of ps.rows.filter(x=>!usedSites.has(x.id))) siteRows.push({canonical_site_code:'',canonical_site_name:'',canonical_operational_customer:'',canonical_contract_supply_amount:'',production_site_uuid:p.id,production_site_name:p.name,production_customer_name:p.company_name||'',production_legacy_budget:p.budget,contract_amount_comparison:'',classification:'PRODUCTION_ONLY',confidence:'',matching_basis:'No canonical identity claimed this UUID',candidate_count:0,recommended_action:'KEEP_PRODUCTION_ONLY',review_reason:'Preserve; may be post-canonical operational data',protected_same_name_group:''});

const canonicalCustomers=[...new Set(canonicalSites.map(x=>x.operational_customer_name).filter(Boolean))].sort(); const customerRows=[]; const usedCustomers=new Set();
for(const name of canonicalCustomers){const exact=pc.rows.filter(p=>n(p.name)===n(name));const alias=name==='삼표피앤씨'?pc.rows.filter(p=>n(p.name)==='삼표피앤씨'):[];const candidates=[...new Map([...exact,...alias].map(x=>[x.id,x])).values()];let classification='CANONICAL_ONLY',basis='No normalized Production match',action='KEEP_CANONICAL_ONLY',reason='';let p=candidates[0];if(candidates.length===1){classification=literalKey(name)===literalKey(p.name)?'EXACT':'AUTO_SAFE_ALIAS';basis=classification==='EXACT'?'literal name after spacing/punctuation normalization':'single corporate-form or approved operational/legal alias';action='LINK';usedCustomers.add(p.id)}else if(candidates.length>1){classification='REVIEW_REQUIRED';basis='Multiple Production candidates';action='DEFER';reason='Choose operational UUID';addReview('CUSTOMER',name,candidates,basis,'HIGH','DEFER')};customerRows.push({canonical_customer_name:name,production_customer_uuid:p?.id||'',production_customer_name:p?.name||'',classification,matching_basis:basis,recommended_action:action,review_reason:reason})}
for(const p of pc.rows.filter(x=>!usedCustomers.has(x.id))){const invalid=['확인중','npc100010말남음'].includes(n(p.name));customerRows.push({canonical_customer_name:'',production_customer_uuid:p.id,production_customer_name:p.name,classification:invalid?'INVALID_LOOKING_VALUE':'PRODUCTION_ONLY',matching_basis:invalid?'Known placeholder-looking value':'No canonical operational customer claimed this UUID',recommended_action:invalid?'INVALID_LOOKING_VALUE':'KEEP_PRODUCTION_ONLY',review_reason:'Preserve pending user decision'});if(invalid)addReview('CUSTOMER','', [p],'Production placeholder-looking value exists','MEDIUM','INVALID_LOOKING_VALUE')}

const canonicalWorkers=[...new Set(logs.map(x=>x.worker_name).filter(Boolean))].sort(); const workerRows=[]; const usedWorkers=new Set();
for(const name of canonicalWorkers){const exact=pw.rows.filter(p=>n(p.name)===n(name));const philip=/필립/.test(name)?pw.rows.filter(p=>/필립/.test(p.name)):[];const equipment=/스카이|장비/.test(name);const candidates=[...new Map([...exact,...philip].map(x=>[x.id,x])).values()];let classification='CANONICAL_ONLY',basis='No Production exact identity',action='KEEP_CANONICAL_ONLY',reason='';let p=exact[0]||candidates[0];if(equipment){classification='REVIEW_REQUIRED';basis='Equipment-looking canonical worker identity';action='DEFER';reason='Common equipment is not a person';addReview('WORKER',name,candidates,basis,'HIGH','DEFER')}else if(/필립/.test(name)&&candidates.length>1){classification='REVIEW_REQUIRED';basis='필립 and 외국인(필립) coexist';action='DEFER';reason='Automatic same-person decision prohibited';addReview('WORKER',name,candidates,basis,'HIGH','DEFER')}else if(exact.length===1){classification='EXACT';basis='normalized exact worker name';action='LINK';usedWorkers.add(p.id)}else if(candidates.length){classification='REVIEW_REQUIRED';basis='Alias candidate only';action='DEFER';addReview('WORKER',name,candidates,basis,'HIGH','DEFER')};workerRows.push({canonical_worker_name:name,production_worker_uuid:p?.id||'',production_worker_name:p?.name||'',production_daily:p?.daily??'',classification,matching_basis:basis,recommended_action:action,review_reason:reason})}
for(const p of pw.rows.filter(x=>!usedWorkers.has(x.id))) workerRows.push({canonical_worker_name:'',production_worker_uuid:p.id,production_worker_name:p.name,production_daily:p.daily,classification:'PRODUCTION_ONLY',matching_basis:'No canonical identity claimed this UUID',recommended_action:'KEEP_PRODUCTION_ONLY',review_reason:'Preserve pending review'});

const counts=(rows,key)=>Object.fromEntries([...new Set(rows.map(x=>x[key]))].sort().map(k=>[k,rows.filter(x=>x[key]===k).length]));
const duplicateClaims=[...claimed.entries()].filter(([uuid])=>siteRows.filter(x=>['EXACT','AUTO_SAFE_LINK'].includes(x.classification)&&x.production_site_uuid===uuid).length>1);
const summary={dataset_version:expectedVersion,source_sha256:expectedSha,production_counts:{customers:pc.count,sites:ps.count,workers:pw.count,work_logs:pl.count,transactions:pt.count,checklists:pch.count},canonical_counts:{sites:canonicalSites.length,customers:canonicalCustomers.length,workers:canonicalWorkers.length,work_logs:logs.length,expenses:expenses.length},site_classifications:counts(siteRows,'classification'),customer_classifications:counts(customerRows,'classification'),worker_classifications:counts(workerRows,'classification'),automatic_links:{sites:siteRows.filter(x=>['EXACT','AUTO_SAFE_LINK'].includes(x.classification)).length,customers:customerRows.filter(x=>['EXACT','AUTO_SAFE_ALIAS'].includes(x.classification)).length,workers:workerRows.filter(x=>x.classification==='EXACT').length},review_required:reviews.length,canonical_only:{sites:siteRows.filter(x=>x.classification==='CANONICAL_ONLY').length,customers:customerRows.filter(x=>x.classification==='CANONICAL_ONLY').length,workers:workerRows.filter(x=>x.classification==='CANONICAL_ONLY').length},production_only:{sites:siteRows.filter(x=>x.classification==='PRODUCTION_ONLY').length,customers:customerRows.filter(x=>x.classification==='PRODUCTION_ONLY').length,workers:workerRows.filter(x=>x.classification==='PRODUCTION_ONLY').length},duplicate_uuid_claims:duplicateClaims,post_canonical_worklogs:{cutoff:'2026-08-31',count:pl.rows.filter(x=>x.date>='2026-09-01').length,min_date:pl.rows.map(x=>x.date).filter(x=>x>='2026-09-01').sort()[0]||null,max_date:pl.rows.map(x=>x.date).filter(x=>x>='2026-09-01').sort().at(-1)||null},reference_coverage:{work_logs:{site_refs:[...new Set(pl.rows.map(x=>x.site_id).filter(Boolean))].length,worker_refs:[...new Set(pl.rows.map(x=>x.worker_id).filter(Boolean))].length},transactions:{site_refs:[...new Set(pt.rows.map(x=>x.site_id).filter(Boolean))].length}},date_ranges:{work_logs:[pl.rows.map(x=>x.date).sort()[0],pl.rows.map(x=>x.date).sort().at(-1)],transactions:[pt.rows.map(x=>x.date).sort()[0],pt.rows.map(x=>x.date).sort().at(-1)]},blocking_issues:duplicateClaims.length?['BLOCKED_DUPLICATE_UUID_CLAIM']:[]};
const writeCsv=(name,rows)=>writeFileSync(resolve(out,name),Papa.unparse(rows,{newline:'\n'})+'\n');mkdirSync(out,{recursive:true});writeCsv('phase4-site-crosswalk.csv',siteRows);writeCsv('phase4-customer-crosswalk.csv',customerRows);writeCsv('phase4-worker-crosswalk.csv',workerRows);writeCsv('phase4-identity-review.csv',reviews);writeFileSync(resolve(out,'phase4-identity-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
