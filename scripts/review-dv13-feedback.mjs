import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {fingerprint,validateReviewedCase,questionKey} from '../modules/evaluation/dv13.ts';

export async function admitFeedback(data,root){
  const row=validateReviewedCase(data);
  const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));
  const existing=[];
  for(const file of manifest.files){
    const content=await fs.readFile(new URL(file.path,root));
    if(fingerprintBytes(content)!==file.sha256)throw new Error('EVALUATION_HASH_MISMATCH');
    existing.push(...content.toString('utf8').split('\n').filter(Boolean).map(JSON.parse));
  }
  if(existing.some(c=>c.id===row.id||questionKey(c)===questionKey(row)))throw new Error('DUPLICATE_OR_EXPOSED_CASE');
  const file=manifest.files.find(f=>f.cohort===(row.cohort==='held-out'?'independent':'real-failures'));
  if(!file)throw new Error('COHORT_NOT_CONFIGURED');
  // Only reviewed case fields enter the corpus; observed engine output is excluded.
  const {id,category,prompt,turns,answerable,expected,cohort,provenance,review}=row;
  const target=new URL(file.path,root),old=await fs.readFile(target,'utf8');
  const content=old+JSON.stringify({id,category,prompt,turns,answerable,expected,cohort,provenance,review})+'\n';
  await fs.writeFile(target,content);
  file.sha256=fingerprintBytes(Buffer.from(content));
  await fs.writeFile(new URL('manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
  return {id,cohort:file.cohort};
}

async function main(){
const [mode,input,output] = process.argv.slice(2);
if(!['stage','admit'].includes(mode)||!input)throw new Error('Usage: review-dv13-feedback.mjs stage <export.json> <new-review.json> | admit <review.json>');
const bytes=await fs.readFile(input);if(bytes.length>1048576)throw new Error('REPORT_BUDGET');
const data=JSON.parse(bytes.toString('utf8'));
const root=new URL('../data/dv13/evaluation/',import.meta.url);
if(mode==='stage'){
  if(!output)throw new Error('An explicit local output path is required.');
  if(data.provenance?.kind!=='local-opt-in-export'||typeof data.prompt!=='string'||!data.prompt.trim())throw new Error('INVALID_LOCAL_REPORT');
  const candidate={id:'user-'+fingerprint([data.turns??[],data.prompt]).slice(0,16),category:'',prompt:data.prompt,turns:data.turns??[],answerable:null,expected:{},cohort:'development',
    provenance:{kind:'real-failure',author:'',capturedAt:data.provenance.capturedAt},
    review:{reviewer:'',reviewedAt:'',consentConfirmed:false,privacyReviewed:false,expectedApproved:false,contextComplete:false,heldOutFromDevelopment:false,evidence:''},
    suggestedBehavior:data.expected??'',observedOutput:data.observedOutput??''};
  await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});
  await fs.writeFile(output,JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});
  console.log('Created a local review draft. It is not admitted to evaluation.');
}else{
  const result=await admitFeedback(data,root);
  console.log(`Admitted ${result.id} to ${result.cohort}; review the data and manifest together before committing.`);
}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();
function fingerprintBytes(bytes){return createHash('sha256').update(bytes).digest('hex');}
