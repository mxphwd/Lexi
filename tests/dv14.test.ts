import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {Session} from '../modules/dv12/runtime';
import {parse} from '../modules/dv12/parser';
import {coreStore,Store} from '../modules/dv12/store';
import {emptyState,entity,variable,type Fact,type Select} from '../modules/dv12/types';
import {execute} from '../modules/dv12/executor';
import {canonicalIdentity} from '../modules/dv12/identity';
import {validateHttpRequest,validateHttpResponse} from '../modules/dv12/runtime-validation';
import {resourceLoader} from '../worker/dv12-resources';

const assets={async fetch(input:RequestInfo|URL){
  const url=new URL(input instanceof Request?input.url:String(input));
  try{return new Response(await fs.readFile(new URL('../public'+url.pathname,import.meta.url)));}
  catch{return new Response('missing',{status:404});}
}};

test('DV14 capital paraphrases preserve role-correct semantic plans',()=>{
  const expected=new Session().prepare('What is the capital of France?').execution.results[0];
  for(const prompt of ['Could you tell me the French capital?','France has which capital?']){
    const result=new Session().prepare(prompt).execution.results[0];
    assert.deepEqual(result.selectedPlan,expected.selectedPlan,prompt);assert.deepEqual(result.values,expected.values,prompt);
  }
  for(const prompt of ['Paris is the capital of which country?','Which country has Paris as its capital?']){
    const result=new Session().prepare(prompt).execution.results[0];
    assert.equal(result.status,'supported',prompt);assert.deepEqual(result.values,[entity('country-france')],prompt);
    assert.equal(result.selectedPlan.kind,'query');if(result.selectedPlan.kind==='query')assert.equal(result.selectedPlan.atoms[0].subject.kind,'variable');
  }
});

test('DV14 active and passive invention questions share one relation with reversed answer binding',()=>{
  const prompts=['Who invented the telephone?','By whom was the telephone invented?','Who was the telephone invented by?'];
  for(const prompt of prompts){const r=new Session().prepare(prompt).execution.results[0];assert.equal(r.status,'supported');assert.equal(r.selectedPlan.kind,'query');if(r.selectedPlan.kind==='query')assert.equal(r.selectedPlan.atoms[0].relation,'inventor');}
  const inverse=new Session().prepare('What did Alexander Graham Bell invent?').execution.results[0];
  assert.equal(inverse.status,'supported');assert.deepEqual(inverse.values,[entity('technology-telephone')]);
});

test('DV14 coordination distinguishes multiple subjects from multiple requested properties',()=>{
  const subjects=new Session().prepare('What are the capitals of France, Germany, and Italy?').execution.results[0];
  assert.deepEqual(subjects.values,[entity('city-paris'),entity('city-berlin'),entity('city-rome')]);
  const properties=parse('What are France’s capital and official language?',coreStore(),emptyState());
  assert.equal(properties.clauses.length,2);assert.deepEqual(properties.clauses.map(c=>c.semantic?.intent?.kind),['lookup','lookup']);
});

test('DV14 scoped negation and multiword quantifiers never leak operators into names',()=>{
  const negative=new Session().prepare('Is Paris not the capital of France?').execution.results[0];
  assert.equal(negative.status,'contradicted');assert.match(negative.text,/^No\./);assert.ok(negative.claims.every(claim=>claim.verified));
  const quantified=new Session().prepare('Are exactly twenty one animals mammals?').execution.results[0];
  assert.equal(quantified.selectedPlan.kind,'query');
  if(quantified.selectedPlan.kind==='query'){
    assert.deepEqual(quantified.selectedPlan.quantifier,{kind:'exact',count:21});
    assert.equal(quantified.selectedPlan.atoms[0].object.kind,'entity');
  }
  assert.equal(quantified.code,'OPEN_UNIVERSE');
});

test('DV14 temporal and freshness boundaries are explicit',()=>{
  const dated=parse('What was the capital of France during the 19th century?',coreStore(),emptyState()).clauses[0].alternatives[0].plan;
  assert.equal(dated.kind,'query');if(dated.kind==='query'){assert.equal(dated.atoms[0].from,'1801-01-01');assert.equal(dated.atoms[0].to,'1900-12-31');}
  for(const prompt of ['What is the current population of France?','What is the latest capital of France?']){
    const result=new Session().prepare(prompt).execution.results[0];assert.equal(result.selectedPlan.kind,'unknown');assert.equal(result.status,'unknown');assert.match(result.text,/current answer|time-valid evidence/);
  }
});

test('DV14 nested language produces an inspectable join even when evidence is incomplete',async()=>{
  const prompt='What is the capital of the country where Einstein was born?';
  const sync=new Session().prepare(prompt).execution.results[0];assert.equal(sync.selectedPlan.kind,'query');
  if(sync.selectedPlan.kind==='query')assert.deepEqual(sync.selectedPlan.atoms.map(a=>a.relation),['birthplace','country','capital']);
  const loaded=await new Session().prepareAsync(prompt,resourceLoader(assets,'http://lexi.local'));
  assert.ok(loaded.execution.coverage);assert.ok(loaded.execution.coverage!.loadedShards<=32);assert.ok(loaded.execution.coverage!.unresolvedFrontiers?.includes('country'));
  assert.ok(['supported','unknown','insufficient'].includes(loaded.execution.status));
});

test('DV14 comparisons require or disclose the metric and percentage arithmetic is typed',()=>{
  assert.equal(new Session().prepare('Compare Earth and Mars').execution.results[0].selectedPlan.kind,'unknown');
  assert.match(new Session().respond('Which is smaller Earth or Mars?').text,/diameter/);
  const percent=new Session().prepare('What percentage larger is Earth than Mars?').execution.results[0];assert.equal(percent.selectedPlan.kind,'unknown');
  const explicit=new Session().prepare('What percentage larger is Earth than Mars in diameter?').execution.results[0];assert.equal(explicit.selectedPlan.kind,'compare');if(explicit.selectedPlan.kind==='compare')assert.equal(explicit.selectedPlan.mode,'percentage');
  assert.deepEqual(new Session().prepare('What is 15% more than 80?').execution.results[0].values,[{kind:'number',value:92}]);
});

test('DV14 request-local inventory reasoning combines owners without mutating dialogue facts',()=>{
  const prepared=new Session().prepare('Alice has five apples and Bob has three apples; how many apples do they have together?');
  assert.deepEqual(prepared.execution.results[0].values,[{kind:'number',value:8}]);assert.match(prepared.reply.text,/Together, Alice and Bob have 8 apples/);assert.ok(prepared.execution.results[0].claims.every(claim=>claim.verified));
});

test('DV14 procedures require reviewed procedure evidence',()=>{
  const store=new Store();store.addEntity({id:'task',name:'task',aliases:[],type:'object'});
  const query:Select={kind:'query',atoms:[{subject:entity('task'),relation:'steps',object:variable('answer')}],filters:[],answer:'answer',shape:'procedure'};
  const source=(review:Fact['source']['review']):Fact['source']=>({id:'fixture',location:'fixture',method:'fixture',review,license:'test'});
  store.addFact({id:'unreviewed',subject:'task',relation:'steps',object:{kind:'list',ordered:true,values:[{kind:'text',value:'Do the thing'}]},source:source('seed')});
  assert.equal(execute(query,store,emptyState()).code,'PROCEDURE_REQUIRES_REVIEW');
});

test('DV14 capability boundaries, canonical identities and runtime validation are explicit',()=>{
  for(const prompt of ['Write a poem about Paris','Translate hello to Korean','Recommend a restaurant']){
    const result=new Session().prepare(prompt).execution.results[0];assert.equal(result.selectedPlan.kind,'unknown');assert.match(result.text,/outside Lexi's deterministic/);
  }
  assert.equal(canonicalIdentity('wd:Q142',coreStore()),'country-france');
  assert.throws(()=>validateHttpRequest({version:12,input:'Hello',injected:true}),/UNKNOWN_REQUEST_FIELD/);
  const prepared=new Session().prepare('Hello');
  const payload={version:12,reply:prepared.reply,state:{revision:1,nextTurn:2,memories:[],topics:[],answerEntities:[]}};
  assert.equal(validateHttpResponse(payload).version,12);
  assert.throws(()=>validateHttpResponse({...payload,injected:true}),/UNKNOWN_RESPONSE_FIELD/);
});

test('DV14 confidence remains unavailable but emits a raw feature vector',()=>{
  const reply=new Session().respond('What is the capital of France?');
  assert.equal(reply.trace.confidenceAvailable,false);assert.equal(reply.trace.runtimeVersion,'DV15');
  assert.equal(reply.trace.confidenceComponents?.realizationVerification,1);
});
