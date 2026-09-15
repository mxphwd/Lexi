import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {Session} from '../modules/dv12/runtime.ts';
import {grade,summarize} from '../modules/evaluation/dv12.ts';
import {stageOutcome,summarizeStages} from '../modules/evaluation/dv14.ts';
import {resourceLoader} from '../worker/dv12-resources.ts';
import {handleDv12} from '../worker/dv12-handler.ts';
import {LEXI_BUILD} from '../lib/lexi/version.ts';

const root=new URL('../data/dv14/evaluation/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));
const cohorts={};
for(const file of manifest.files){
  const bytes=await fs.readFile(new URL(file.path,root));
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('EVALUATION_HASH_MISMATCH:'+file.path);
  cohorts[file.cohort]=bytes.toString('utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
}
const assets={async fetch(input){const url=new URL(input.url??input);try{return new Response(await fs.readFile(new URL('../public'+url.pathname,import.meta.url)));}catch{return new Response('missing',{status:404});}}};
const measured=[];
for(const row of cohorts.development){
  const session=new Session(),loader=resourceLoader(assets,'http://lexi.local'),started=performance.now();
  const prepared=await session.prepareAsync(row.prompt,loader);
  const response=await handleDv12(new Request('http://lexi.local/api/lexi/respond',{method:'POST',body:JSON.stringify({version:12,input:row.prompt})}),assets);
  if(!response.ok)throw new Error('HTTP_EVALUATION_'+response.status);
  const payload=await response.json();if(payload.reply.text!==prepared.reply.text)throw new Error('HTTP_RUNTIME_DIVERGENCE:'+row.id);
  measured.push({...row,grade:grade(row,prepared.execution.results),milliseconds:performance.now()-started,confidence:prepared.execution.results.length===1?prepared.execution.results[0].confidence:null,stages:stageOutcome(prepared.execution),output:prepared.reply.text});
}
const independent=cohorts.independent??[],calibration=cohorts.calibration??[];
const development=summarize(measured),gate={minimumIndependentCases:2000,availableIndependentCases:independent.length,minimumCalibrationCases:600,availableCalibrationCases:calibration.length,developmentRegressions:measured.filter(row=>!['correct-answer','correct-abstention'].includes(row.grade.outcome)).map(row=>row.id),broadAccuracyClaimPermitted:false,passed:false};
gate.passed=independent.length>=2000&&calibration.length>=600&&!gate.developmentRegressions.length;
gate.broadAccuracyClaimPermitted=gate.passed;
const report={version:'DV14',build:LEXI_BUILD,releaseStatus:'development',population:manifest.population,warning:'Development regressions are not an availability or accuracy estimate.',development,stageMetrics:summarizeStages(measured.map(row=>row.stages)),independent:{samples:independent.length,measured:false},calibration:{samples:calibration.length,fitted:false},gate,rows:measured};
const out=new URL('../docs/dv14/',import.meta.url);await fs.mkdir(out,{recursive:true});await fs.writeFile(new URL('evaluation-results.json',out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({development,stageMetrics:report.stageMetrics,gate},null,2));
if(gate.developmentRegressions.length)process.exitCode=1;
if(process.argv.includes('--rc')&&!gate.passed)process.exitCode=1;
