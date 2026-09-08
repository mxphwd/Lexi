import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {Session} from '../modules/dv12/runtime.ts';
import {summarize} from '../modules/evaluation/dv12.ts';
import {gradeDv13,adjudicate,fingerprint,validateReviewedCase,checkCohortSeparation} from '../modules/evaluation/dv13.ts';
import {resourceLoader} from '../worker/dv12-resources.ts';
import {LEXI_BUILD} from '../lib/lexi/version.ts';
const root=new URL('../data/dv13/evaluation/',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8')),rows=[];
for(const file of manifest.files){
  const bytes=await fs.readFile(new URL(file.path,root));
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('EVALUATION_HASH_MISMATCH:'+file.path);
  for(const line of bytes.toString('utf8').split('\n').filter(Boolean)){
    const row=JSON.parse(line);
    if(!row.id||!row.category||typeof row.prompt!=='string'||typeof row.answerable!=='boolean'||!row.expected||!row.provenance||rows.some(r=>r.id===row.id))throw new Error('INVALID_OR_DUPLICATE_CASE');
    if(['independent','real-failures'].includes(file.cohort)){
      validateReviewedCase(row);
      if((row.cohort==='held-out')!==(file.cohort==='independent'))throw new Error('COHORT_MISMATCH');
    }else if(!['audit-regression','development-diagnostic'].includes(row.provenance.kind))throw new Error('INVALID_DEVELOPMENT_PROVENANCE');
    rows.push({...row,evaluationCohort:file.cohort});
  }
}
checkCohortSeparation(rows.filter(r=>r.evaluationCohort!=='independent'),rows.filter(r=>r.evaluationCohort==='independent'));
const adjudications=JSON.parse(await fs.readFile(new URL('adjudications.json',root),'utf8'));
if(!Array.isArray(adjudications)||new Set(adjudications.map(r=>r.caseId)).size!==adjudications.length)throw new Error('INVALID_ADJUDICATION_FILE');
const assets={async fetch(input){const url=new URL(input.url??input);try{return new Response(await fs.readFile(new URL('../public'+url.pathname,import.meta.url)));}catch{return new Response('missing',{status:404});}}};
const measured=[];
for(const row of rows){
  const s=new Session(),loader=resourceLoader(assets,'http://lexi.local'),start=performance.now();
  try{
    for(const turn of row.turns??[])s.commit(await s.prepareAsync(turn,loader));
    const p=await s.prepareAsync(row.prompt,loader);
    // Reviews bind to the exact case, response, answer values and plan. A change requires a new review.
    const responseHash=fingerprint({case:row,output:p.reply.text,results:p.execution.results.map(r=>({plan:r.selectedPlan,status:r.status,values:r.values}))});
    const rawGrade=gradeDv13(row,p.execution.results);
    measured.push({...row,grade:adjudicate(rawGrade,adjudications.find(a=>a.caseId===row.id),row.id,responseHash),responseHash,milliseconds:performance.now()-start,confidence:p.execution.results.length===1?p.execution.results[0].confidence:null,output:p.reply.text,status:p.execution.status,plans:p.execution.results.map(r=>r.selectedPlan)});
  }catch(error){measured.push({...row,grade:{outcome:'evaluator-error',reason:String(error),adjudication:false},milliseconds:performance.now()-start,confidence:null});}
}
const independent=measured.filter(r=>r.evaluationCohort==='independent'),development=measured.filter(r=>r.evaluationCohort!=='independent');
const summary=summarize(independent),requiredCategories=['ordinary-facts','arithmetic','quantities','reasoning','language','multi-part','dialogue','ambiguity','reference','explanations','procedures','comparisons'];
const ledger=JSON.parse(await fs.readFile(new URL('../docs/dv12/implementation-ledger.json',import.meta.url),'utf8'));
const profiles=JSON.parse(await fs.readFile(new URL('../data/dv12/calibration/profiles.json',import.meta.url),'utf8'));
const rcGate={minimumIndependentRows:2000,available:independent.length,calibrationAvailable:profiles.length>0&&independent.some(r=>r.confidence!==null),
  unresolvedP0:ledger.items.filter(r=>r.priority==='P0'&&r.status!=='implemented-and-tested').map(r=>r.id),
  missingCategories:requiredCategories.filter(category=>independent.filter(r=>r.category===category).length<50),
  adjudicationPending:summary.precision.unresolved,
  thresholds:{answerPossibility:.6,answerPrecision:.99,maximumHighConfidenceError:.007,minimumHighConfidenceSamples:600},passed:false};
rcGate.passed=independent.length>=2000&&!rcGate.unresolvedP0.length&&!rcGate.missingCategories.length&&rcGate.calibrationAvailable&&summary.precision.unresolved===0&&summary.answerPossibility>=.6&&summary.precision.lowerBound>=.99&&summary.highConfidenceError.samples>=600&&summary.highConfidenceError.rate<=.007&&summary.outcomes['evaluator-error']===0;
const baselineRegressions=(manifest.baselineMustRemainCorrect??[]).filter(id=>!measured.some(r=>r.id===id&&r.grade.outcome==='correct-answer'));
const report={version:'DV13',build:LEXI_BUILD,releaseStatus:'development',population:manifest.population,
  independence:'Authored regression questions and previously seen failures are development evidence only. No public-use accuracy estimate is established.',
  baselineRegressions,development:summarize(development),cohorts:Object.fromEntries([...new Set(measured.map(r=>r.evaluationCohort))].map(c=>[c,summarize(measured.filter(r=>r.evaluationCohort===c))])),independent:summary,rcGate,rows:measured};
const out=new URL('../docs/dv13/',import.meta.url);await fs.mkdir(out,{recursive:true});
await fs.writeFile(new URL('evaluation-results.json',out),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(new URL('adjudication-queue.json',out),JSON.stringify(measured.filter(r=>r.grade.adjudication).map(r=>({caseId:r.id,prompt:r.prompt,turns:r.turns,expected:r.expected,output:r.output,reason:r.grade.reason,responseHash:r.responseHash,outcome:null,reviewer:'',reviewedAt:'',rationale:'',humanReviewed:false})),null,2)+'\n');
console.log(JSON.stringify({development:report.development,independent:report.independent,rcGate:{passed:rcGate.passed,available:rcGate.available,unresolvedP0:rcGate.unresolvedP0.length,adjudicationPending:rcGate.adjudicationPending}},null,2));
if(process.argv.includes('--rc')&&!rcGate.passed)process.exitCode=1;
if(measured.some(r=>r.grade.outcome==='evaluator-error'&&!r.grade.adjudication))process.exitCode=1;
if(measured.some(r=>r.evaluationCohort==='paraphrases'&&r.grade.outcome!==(r.answerable?'correct-answer':'correct-abstention')))process.exitCode=1;

if(baselineRegressions.length){console.error('Baseline regressions:',baselineRegressions);process.exitCode=1;}
