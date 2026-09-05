import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {Session} from '../modules/dv12/runtime.ts';
import {grade,summarize} from '../modules/evaluation/dv12.ts';
import {resourceLoader} from '../worker/dv12-resources.ts';
const root=new URL('../data/dv12/evaluation/',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8')),rows=[];
for(const item of manifest.files){
  const bytes=await fs.readFile(new URL(item.path,root));
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('EVALUATION_HASH_MISMATCH');
  for(const line of bytes.toString('utf8').split('\n').filter(Boolean)){
    const row=JSON.parse(line);
    if(!row.id||!row.category||typeof row.prompt!=='string'||typeof row.answerable!=='boolean'||!row.expected||!row.provenance)throw new Error('INVALID_EVALUATION_ROW');
    if(rows.some(r=>r.id===row.id))throw new Error('DUPLICATE_EVALUATION_ID');rows.push(row);
  }
}
const assets={async fetch(input){const url=new URL(input.url??input);try{return new Response(await fs.readFile(new URL('../public'+url.pathname,import.meta.url)));}catch{return new Response('missing',{status:404});}}};
const measured=[];
for(const row of rows){
  const s=new Session(),loader=resourceLoader(assets,'http://lexi.local'),start=performance.now();
  try{
    for(const turn of row.turns??[]){const prepared=await s.prepareAsync(turn,loader);s.commit(prepared);}
    const p=await s.prepareAsync(row.prompt,loader);
    measured.push({...row,grade:grade(row,p.execution.results),milliseconds:performance.now()-start,confidence:p.execution.results.length===1?p.execution.results[0].confidence:null,output:p.reply.text,status:p.execution.status,plans:p.execution.results.map(r=>r.selectedPlan),propositionIds:p.reply.trace.propositionIds});
  }catch(error){measured.push({...row,grade:{outcome:'evaluator-error',reason:String(error),adjudication:false},milliseconds:performance.now()-start,confidence:null});}
}
const independent=measured.filter(r=>['independent-blind','real-failure'].includes(r.provenance.kind));
const categories=Object.fromEntries([...new Set(measured.map(r=>r.category))].map(category=>[category,summarize(measured.filter(r=>r.category===category))]));
const ledger=JSON.parse(await fs.readFile(new URL('../docs/dv12/implementation-ledger.json',import.meta.url)));
const profiles=JSON.parse(await fs.readFile(new URL('../data/dv12/calibration/profiles.json',import.meta.url)));
const unresolvedP0=ledger.items.filter(r=>r.priority==='P0'&&r.status!=='implemented-and-tested').map(r=>r.id);
const summary=summarize(independent),requiredCategories=['ordinary-facts','arithmetic','quantities','reasoning','language','multi-part','dialogue','ambiguity','reference','explanations','procedures','comparisons'];
const missingCategories=requiredCategories.filter(category=>independent.filter(r=>r.category===category).length<50);
const gate={
  minimumIndependentRows:2000,available:independent.length,
  calibrationAvailable:profiles.length>0&&independent.some(r=>r.confidence!==null),
  unresolvedP0,missingCategories,adjudicationPending:summary.precision.unresolved,
  thresholds:{answerPossibility:.6,answerPrecision:.99,maximumHighConfidenceError:.007,minimumHighConfidenceSamples:600},
  passed:false
};
gate.passed=independent.length>=2000&&!unresolvedP0.length&&!missingCategories.length&&gate.calibrationAvailable&&summary.precision.unresolved===0&&summary.answerPossibility>=.6&&summary.precision.lowerBound>=.99&&summary.highConfidenceError.samples>=600&&summary.highConfidenceError.rate<=.007;
const report={version:'DV12',population:manifest.population,independence:'Development diagnostics are not a public-use availability estimate.',diagnostic:summarize(measured),categories,independent:summary,rcGate:gate,rows:measured};
await fs.mkdir(new URL('../docs/dv12/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../docs/dv12/evaluation-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({diagnostic:report.diagnostic,categories,rcGate:report.rcGate},null,2));
if(process.argv.includes('--rc')&&!report.rcGate.passed)process.exitCode=1;
