import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {admitFeedback} from '../scripts/review-dv13-feedback.mjs';
import {Session} from '../modules/dv12/runtime';
import {segment} from '../modules/dv12/parser';
import {handleDv12,type ClientState} from '../worker/dv12-handler';
import {gradeDv13,adjudicate,fingerprint,checkCohortSeparation,validateReviewedCase,type ReviewedCase} from '../modules/evaluation/dv13';
import type {Case} from '../modules/evaluation/dv12';
import {failurePreview} from '../lib/lexi/failure-export';

const assets={async fetch(input:RequestInfo|URL){
  const url=new URL(input instanceof Request?input.url:String(input));
  try{return new Response(await fs.readFile(new URL('../public'+url.pathname,import.meta.url)));}
  catch{return new Response('missing',{status:404});}
}};
async function send(input:string,state?:ClientState){
  const response=await handleDv12(new Request('http://lexi.local/api/lexi/respond',{method:'POST',body:JSON.stringify({version:12,input,state})}),assets);
  assert.equal(response.status,200);
  return response.json();
}
test('DV13 equivalent question families preserve subject, relation, values and evidence',()=>{
  for(const subject of ['France','Germany']){
    const baseline=new Session().prepare(`What is the capital of ${subject}?`).execution.results[0];
    for(const prompt of [`Which city is the capital of ${subject}?`,`Please give me the capital of ${subject}.`,`Could you please tell me what is the capital of ${subject}?`,`Name the capital of ${subject}.`,`Show me ${subject}’s capital.`]){
      const r=new Session().prepare(prompt).execution.results[0];
      assert.deepEqual(r.selectedPlan,baseline.selectedPlan,prompt);
      assert.deepEqual(r.values,baseline.values,prompt);assert.deepEqual(r.facts,baseline.facts,prompt);
    }
  }
});
test('DV13 wording support retains scope, negation, ambiguous names and unknown subjects',()=>{
  for(const prompt of ['Do not tell me the capital of France.','Which planet is the capital of France?','Which city is not the capital of France?','What is the capital of Atlantis?','What is the capital of France if Paris were in Germany?']){
    const r=new Session().prepare(prompt).execution.results[0];
    assert.ok(!['supported','contradicted'].includes(r.status),prompt);
  }
  const p=new Session().prepare('Please tell me what was the capital of France in 1800?').execution.results[0].selectedPlan;
  assert.equal(p.kind,'query');if(p.kind==='query')assert.equal(p.atoms[0].from,'1800-01-01');
  assert.equal(new Session().prepare('Please tell me what is a bank?').execution.status,'ambiguous');
  const s=new Session();s.respond('What is Earth? What is Mars?');assert.match(s.respond('What about the latter?').text,/Mars/);
});
test('DV13 preserves multiword memory values containing periods and abbreviations',async()=>{
  const fullName='Sir. Sebastian H. Ray Sr.';
  assert.deepEqual(
    segment(`My name is ${fullName} What is my name?`).map((clause)=>clause.text),
    [`My name is ${fullName}`, 'What is my name?'],
  );
  const session=new Session();
  const reply=session.respond(`My name is ${fullName} What is my name?`);
  assert.match(reply.text,/Your name is Sir\. Sebastian H\. Ray Sr\./);
  assert.equal(session.snapshot().memories.find((memory)=>memory.field==='name')?.value,'Sir. Sebastian H. Ray Sr');

  session.respond('I live in St. Louis.');
  assert.match(session.respond('Where do I live?').text,/St\. Louis/);
  session.respond('I prefer products from Acme Co. Ltd.');
  assert.match(session.respond('What do I prefer?').text,/Acme Co\. Ltd/);

  let http=await send(`My name is ${fullName}`);
  assert.equal(http.state.memories.find((memory:{field:string})=>memory.field==='name')?.value,'Sir. Sebastian H. Ray Sr');
  http=await send('What is my name?',http.state);
  assert.match(http.reply.text,/Sir\. Sebastian H\. Ray Sr\./);
});
test('DV13 abbreviation protection does not absorb a following request',()=>{
  assert.deepEqual(
    segment('My name is Dana Ray Sr. What is gravity?').map((clause)=>clause.text),
    ['My name is Dana Ray Sr.', 'What is gravity?'],
  );
  assert.deepEqual(
    segment('I am from the U.S. Where am I from?').map((clause)=>clause.text),
    ['I am from the U.S.', 'Where am I from?'],
  );
});
test('DV13 fast-paths inert terminal symbols without changing the answer',()=>{
  for(const [plain,marked] of [
    ['Hello','Hello!'],
    ['What is gravity','What is gravity?'],
    ['What is the capital of France','What is the capital of France?!'],
    ['What is my name','What is my name？'],
  ]){
    const plainResult=new Session().prepare(plain);
    const markedResult=new Session().prepare(marked);
    assert.equal(markedResult.execution.request.fastPath,'inert-terminal-punctuation',marked);
    assert.equal(markedResult.execution.stages[0].code,'TYPED_PLAN_PUNCTUATION_FAST_PATH',marked);
    assert.deepEqual(markedResult.execution.results,plainResult.execution.results,marked);
    assert.equal(markedResult.reply.text,plainResult.reply.text,marked);
  }
});
test('DV13 keeps semantically meaningful symbols on the full parser path',()=>{
  for(const prompt of ['5!','What is 2.5 + 3?','Explain "What?"','What is gravity? What is math?']){
    assert.equal(new Session().prepare(prompt).execution.request.fastPath,undefined,prompt);
  }
});
test('DV13 HTTP preserves repeated evidence follow-ups and a changed subject',async()=>{
  let data=await send('Which city is the capital of France?');
  const original=data.reply.trace.propositionIds;
  for(const input of ['Why?','Why is that?','How do you know?']){
    data=await send(input,data.state);assert.equal(data.reply.trace.executionStatus,'supported');
    assert.deepEqual(data.reply.trace.propositionIds,original);assert.equal(data.reply.trace.runtimeVersion,'DV13');
  }
  data=await send('And Germany?',data.state);assert.match(data.reply.text,/Berlin/);
  data=await send('Why?',data.state);assert.equal(data.reply.trace.executionStatus,'supported');
  assert.notDeepEqual(data.reply.trace.propositionIds,original);
});
test('DV13 repeated lexical follow-ups keep the selected sense',async()=>{
  let data=await send('Define crane');
  assert.equal(data.reply.trace.executionStatus,'ambiguous');
  data=await send('2',data.state);assert.equal(data.reply.trace.executionStatus,'supported');
  const claims=data.reply.trace.propositionIds;
  for(const input of ['Why?','Why?']){data=await send(input,data.state);assert.deepEqual(data.reply.trace.propositionIds,claims);}
});
test('DV13 feedback includes only opted-in context and redacts before JSON serialization',()=>{
  const reply=new Session().respond('Hello');
  const secret='Mina "M"';
  const without=JSON.parse(failurePreview(secret,'My email is mina@example.com',reply,[secret]));
  assert.equal(without.version,13);assert.deepEqual(without.turns,[]);assert.equal(without.prompt,'[personal value]');
  const withContext=JSON.parse(failurePreview('Why?','',reply,[secret],[`My name is ${secret}`]));
  assert.deepEqual(withContext.turns,['My name is [personal value]']);
  assert.equal(withContext.classification,'unreviewed');assert.equal(withContext.provenance.consent,'local-download-only');
});
test('DV13 human review is required and a local export does not establish evaluation consent',()=>{
  const c:ReviewedCase={id:'test',prompt:'Where is Atlantis?',category:'ordinary-facts',answerable:false,expected:{},cohort:'held-out',provenance:{kind:'real-failure',author:'Test fixture',capturedAt:'2026-09-08'},review:{reviewer:'Fixture reviewer',reviewedAt:'2026-09-08',consentConfirmed:true,privacyReviewed:true,expectedApproved:true,contextComplete:true,heldOutFromDevelopment:true,evidence:'Synthetic fixture only; never admitted.'}};
  assert.equal(validateReviewedCase(c),c);
  for(const flag of ['consentConfirmed','privacyReviewed','expectedApproved','contextComplete','heldOutFromDevelopment'] as const){
    assert.throws(()=>validateReviewedCase({...c,review:{...c.review,[flag]:false}}));
  }
  assert.throws(()=>checkCohortSeparation([c],[{...c,id:'other',prompt:'where is atlantis!'}]),/OVERLAP/);
});
test('DV13 adjudication binds a human decision to the exact response and case',()=>{
  const initial={outcome:'evaluator-error' as const,adjudication:true,reason:'Needs review'},hash=fingerprint({text:'An answer'});
  const review={caseId:'case',responseHash:hash,outcome:'correct-answer' as const,reviewer:'Fixture',reviewedAt:'2026-09-08',rationale:'Synthetic review fixture',humanReviewed:true};
  assert.equal(adjudicate(initial,review,'case',hash).outcome,'correct-answer');
  assert.equal(adjudicate(initial,review,'case','changed').adjudication,true);
  assert.equal(adjudicate(initial,undefined,'case',hash).adjudication,true);
  assert.throws(()=>adjudicate(initial,{...review,humanReviewed:false},'case',hash),/INVALID_HUMAN/);
  const c:Case={id:'none',prompt:'Which city is not the capital of France?',category:'scope',answerable:false,expected:{},provenance:{kind:'development-diagnostic',author:'Fixture',capturedAt:'2026-09-08'}};
  assert.equal(gradeDv13(c,new Session().prepare(c.prompt).execution.results).outcome,'correct-abstention');
});

test('DV13 admission writes only reviewed fields and preserves cohort hashes',async()=>{
  const dir=await fs.mkdtemp(path.join(tmpdir(),'lexi-review-test-')),root=pathToFileURL(dir+'/');
  try {
    const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
    const files=[{path:'development.jsonl',cohort:'real-failures',sha256:hash('')},{path:'independent.jsonl',cohort:'independent',sha256:hash('')}];
    await fs.writeFile(new URL('manifest.json',root),JSON.stringify({version:13,files}));
    for(const file of files)await fs.writeFile(new URL(file.path,root),'');
    const row:ReviewedCase={id:'fixture',prompt:'A synthetic admission test?',category:'test',answerable:false,expected:{},cohort:'development',provenance:{kind:'real-failure',author:'Synthetic fixture only',capturedAt:'2026-09-08'},review:{reviewer:'Fixture',reviewedAt:'2026-09-08',consentConfirmed:true,privacyReviewed:true,expectedApproved:true,contextComplete:true,heldOutFromDevelopment:false,evidence:'Synthetic fixture; isolated temporary corpus.'}};
    await assert.rejects(admitFeedback({...row,review:{...row.review,consentConfirmed:false}},root),/HUMAN_REVIEW/);
    assert.equal(await fs.readFile(new URL('development.jsonl',root),'utf8'),'');
    await admitFeedback({...row,observedOutput:'Must not enter the corpus'},root);
    const content=await fs.readFile(new URL('development.jsonl',root),'utf8');
    assert.equal(JSON.parse(content).observedOutput,undefined);
    const saved=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));
    assert.equal(saved.files[0].sha256,hash(content));
    assert.equal(await fs.readFile(new URL('independent.jsonl',root),'utf8'),'');
    await assert.rejects(admitFeedback({...row,id:'duplicate',cohort:'held-out',review:{...row.review,heldOutFromDevelopment:true}},root),/EXPOSED/);
    await fs.appendFile(new URL('development.jsonl',root),'tampered');
    await assert.rejects(admitFeedback({...row,id:'new',prompt:'Different test'},root),/HASH_MISMATCH/);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
