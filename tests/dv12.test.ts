import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { Session } from '../modules/dv12/runtime';
import { calculate, convert } from '../modules/dv12/numbers';
import { Store, coreStore } from '../modules/dv12/store';
import { execute } from '../modules/dv12/executor';
import { parse, segment } from '../modules/dv12/parser';
import { emptyState, entity, variable, type Fact, type Select } from '../modules/dv12/types';
import { handleDv12 } from '../worker/dv12-handler';
import { resourceLoader } from '../worker/dv12-resources';
import { hash, readBounded } from '../worker/dv12-assets';
import { PackageRegistry, satisfies, type Package } from '../modules/dv12/packages';
import { grade, gradeCanonicalText } from '../modules/evaluation/dv12';
import {fitCalibration,calibratedProbability} from '../modules/dv12/calibration';
import {failurePreview} from '../lib/lexi/failure-export';
import {BrowserSession} from '../lib/lexi/client';

const assets={async fetch(input:RequestInfo|URL){
  const url=new URL(input instanceof Request?input.url:String(input));
  try{const bytes=await fs.readFile(new URL('../public'+url.pathname,import.meta.url));return new Response(bytes);}
  catch{return new Response('missing',{status:404});}
}};
test('DV12 arithmetic consumes complete expressions with precedence and units',()=>{
  for(const [q,value] of [['2 plus 3 times 4',14],['(2+3)*4',20],['1,000 plus 2,000',3000],['10-2*3',4],['2*(3+4)',14],['-2^2',-4],['2^3^2',512],['half of 30',15],['20 percent of 50',10]] as const)assert.equal(calculate(q).value,value,q);
  for(const q of ['2+3 nonsense','2/0','(2+3','2 3'])assert.throws(()=>calculate(q),q);
  assert.equal(convert(2,'hours','minutes'),120);
  assert.ok(Math.abs(convert(100,'celsius','fahrenheit')-212)<1e-9);
  assert.throws(()=>convert(1,'kg','km'));
});
test('DV12 uses bound semantic properties and preserves each coordinated answer',()=>{
  const s=new Session();
  assert.match(s.respond('What is the capital of France?').text,/Paris/);
  const capitals=s.prepare('What are the capitals of France and Germany?');
  assert.deepEqual(capitals.execution.results[0].values,[entity('city-paris'),entity('city-berlin')]);
  assert.equal(capitals.execution.results[0].selectedPlan.kind,'query');
  assert.equal(s.prepare('What is not a mammal?').execution.results[0].selectedPlan.kind,'query');
  assert.notEqual(s.respond('What is not a mammal?').trace.executionStatus,'supported');
  assert.match(s.respond('Could you explain gravity?').text,/gravity/i);
});
test('DV12 verifies full activities, explicit zero, exceptions and open universes',()=>{
  const s=new Session();
  assert.match(s.respond('How many legs does a snake have?').text,/0 legs/);
  assert.equal(s.respond('Do spiders have six legs?').trace.executionStatus,'contradicted');
  assert.match(s.respond('Can penguins fly?').text,/No\. Penguin cannot fly/);
  assert.equal(s.respond('Can penguins swim?').trace.executionStatus,'supported');
  assert.equal(s.respond('Can all birds fly?').trace.executionStatus,'contradicted');
  assert.match(s.respond('Is a penguin an animal?').text,/Yes/);
  assert.doesNotMatch(s.respond('Why does ice melt?').text,/freez/i);
});
test('DV12 executes numeric ranking and comparisons with source proofs',()=>{
  const s=new Session(),rank=s.prepare('List the three largest planets');
  assert.deepEqual(rank.execution.results[0].values.map(v=>v.kind==='entity'?v.id:''),['space-jupiter','space-saturn','space-uranus']);
  assert.equal(rank.execution.results[0].status,'insufficient'); // recorded subset is not all exoplanets
  assert.ok(rank.execution.results[0].facts.some(f=>f.source.id.startsWith('NASA-JPL')));
  assert.match(s.respond('What is the second largest planet?').text,/Saturn/);
  assert.equal(s.prepare('How much larger is Earth than Mars?').execution.results[0].values[0].kind,'number');
});
test('DV12 preserves independent personal fields, compound turns, multiple preferences and deletion',()=>{
  const s=new Session();
  s.respond('My name is Mina and I live in Seoul. What is my name?');
  assert.match(s.respond('Where do I live?').text,/Seoul/);
  s.respond('I am from Paris');s.respond('I live in London');
  assert.match(s.respond('Where am I from?').text,/Paris/);
  s.respond('I like tea');s.respond('I like coffee');
  assert.match(s.respond('What do I like?').text,/tea and coffee/);
  s.respond('Actually, my name is Lena');
  assert.match(s.respond('What is my name?').text,/Lena/);
  s.respond('Forget everything');
  assert.deepEqual(s.snapshot().memories,[]);
  assert.equal(s.snapshot().previous,undefined);
  assert.doesNotMatch(s.respond('What is my name?').text,/Mina|Lena/);
});
test('DV12 prepares without mutation; abort and stale commits cannot change session',async()=>{
  const s=new Session();s.respond('My name is Mina');const before=s.snapshot();
  const p=await s.prepareAsync('My name is Lena');
  assert.deepEqual(s.snapshot(),before);
  const c=new AbortController();c.abort();
  assert.throws(()=>s.commit(p,c.signal),{name:'AbortError'});
  assert.deepEqual(s.snapshot(),before);
  s.respond('I live in Seoul');assert.throws(()=>s.commit(p),/STALE_TRANSACTION/);
  await assert.rejects(s.prepareAsync('What is gravity?',undefined,{signal:c.signal}),{name:'AbortError'});
});
test('DV12 sync and async share plans, values, proof and session transitions',async()=>{
  for(const q of ['Hello','What is gravity?','Can penguins fly?','My name is Mina. What is my name?','What is (2+3)*4?']){
    const a=new Session().prepare(q),b=await new Session().prepareAsync(q);
    assert.deepEqual(a.execution.request,b.execution.request,q);
    assert.deepEqual(a.execution.results,b.execution.results,q);
    assert.deepEqual(a.execution.state,b.execution.state,q);
  }
});
test('DV12 preserves quote scopes, decimals and long clause sequences',()=>{
  assert.equal(segment('What is 2.5 + 3.5? What is gravity?').length,2);
  assert.equal(segment('Explain \"cats and dogs\". What is a cat?').length,2);
  assert.equal(segment('What is France’s capital? What is Germany’s capital?').length,2);
  assert.equal(segment(Array.from({length:8},()=> 'What is gravity?').join(' ')).length,8);
  assert.throws(()=>parse('word '.repeat(2100),coreStore(),emptyState()),/INPUT_BUDGET/);
});
test('DV12 schema, identity, nested values, memory budgets and defensive objects',()=>{
  const s=new Store();s.addEntity({id:'a',name:'A',aliases:[],type:'object'});
  const f:Fact={id:'f',subject:'a',relation:'definition',object:{kind:'text',value:'an object'},source:{id:'test',location:'test:1',method:'fixture',review:'seed',license:'test'}};
  s.addFact(f);assert.throws(()=>s.addFact(f),/DUPLICATE_FACT/);
  assert.throws(()=>s.addFact({...f,id:'nan',object:{kind:'number',value:NaN}}));
  assert.throws(()=>s.addFact({...f,id:'missing',subject:'missing'}));
  f.object={kind:'text',value:'changed'};assert.equal(s.fact('f')!.object.kind,'text');assert.notDeepEqual(s.fact('f')!.object,f.object);
  assert.throws(()=>{s.entity('a')!.name='modified';},TypeError);
});
test('DV12 inverse, symmetric, negative and optional joins preserve proof roles',()=>{
  const s=new Store();for(const id of ['chair','leg','desk'])s.addEntity({id,name:id,aliases:[],type:'object'});
  const source:Fact['source']={id:'test',location:'test',method:'fixture',review:'seed',license:'test'};
  s.addFact({id:'part',subject:'leg',relation:'part_of',object:entity('chair'),source});
  s.addFact({id:'negative',subject:'chair',relation:'is_a',object:entity('desk'),negative:true,source});
  s.addFact({id:'related',subject:'chair',relation:'related_to',object:entity('desk'),source});
  const q=(subject:string,relation:string):Select=>({kind:'query',atoms:[{subject:entity(subject),relation,object:variable('answer')}],filters:[],answer:'answer',shape:'value'});
  assert.deepEqual(execute(q('chair','has_part'),s,emptyState()).values,[entity('leg')]);
  assert.deepEqual(execute(q('desk','related_to'),s,emptyState()).values,[entity('chair')]);
  assert.equal(execute(q('chair','is_a'),s,emptyState()).status,'unknown');
  const negative=q('chair','is_a');negative.atoms[0].negative=true;
  assert.deepEqual(execute(negative,s,emptyState()).values,[entity('desk')]);
  const optional=q('chair','has_part');optional.atoms.push({subject:variable('answer'),relation:'definition',object:variable('description'),optional:true});
  assert.deepEqual(execute(optional,s,emptyState()).values,[entity('leg')]);
});
test('DV12 server responds without returning world packages and rejects invalid bodies',async()=>{
  const request=new Request('http://lexi.local/api/lexi/respond',{method:'POST',body:JSON.stringify({version:12,input:'What is the capital of France?'})});
  const response=await handleDv12(request,assets),data=await response.json();
  assert.equal(response.status,200);assert.match(data.reply.text,/Paris/);assert.equal(data.packages,undefined);
  assert.equal(data.state.previous,undefined);
  const invalid=await handleDv12(new Request(request.url,{method:'POST',body:'x'.repeat(70000)}),assets);
  assert.equal(invalid.status,400);
});
test('DV12 bounded asset reader and hash validation',async()=>{
  assert.equal((await hash(new TextEncoder().encode('abc'))).length,64);
  await assert.rejects(readBounded(new Response('too long').body,3),/BODY_BUDGET/);
});
test('DV12 AD1 package-enabled lookup preserves provenance',async()=>{
  // Source-derived integration fixture, explicitly NOT a blind knowledge benchmark.
  const p=await new Session().prepareAsync('Where was Lydia Dean Pilcher born?',resourceLoader(assets,'http://lexi.local'));
  assert.match(p.reply.text,/America|United States/i);
  assert.ok(p.execution.results[0].facts.some(f=>f.source.method.includes('P19')));
  assert.ok(p.execution.coverage?.loadedShards);
});
test('DV12 typed rules, package hashes, versions, dependencies, and atomic failure',async()=>{
  const base=new Store(),source:Fact['source']={id:'test',location:'test:typed-rule',method:'fixture',review:'seed',license:'test'};
  const pack:Package={manifest:{id:'test',version:'1.0.0',runtime:{major:12,schema:1},dependencies:[]},entities:['a','b','c'].map(id=>({id,name:id,aliases:[],type:'object'})),relations:[{id:'linked',aliases:['linked'],domain:['object'],objectTypes:['object'],range:['entity'],world:'open'}],facts:[{id:'ab',subject:'a',relation:'part_of',object:entity('b'),source},{id:'bc',subject:'b',relation:'part_of',object:entity('c'),source}],rules:[{id:'two-hop',premises:[{subject:variable('x'),relation:'part_of',object:variable('y')},{subject:variable('y'),relation:'part_of',object:variable('z')}],conclusion:{subject:variable('x'),relation:'linked',object:variable('z')},source}],language:[],dialogue:[]};
  const bytes=new TextEncoder().encode(JSON.stringify(pack)),registry=new PackageRegistry(base);
  registry.register({id:'test',version:'1.0.0',sha256:await hash(bytes),decodedBytes:bytes.length,load:async()=>bytes});
  const loaded=await registry.load(['test']);
  const q:Select={kind:'query',atoms:[{subject:entity('a'),relation:'linked',object:variable('answer')}],filters:[],shape:'value',answer:'answer'};
  const r=execute(q,loaded,emptyState());assert.deepEqual(r.values,[entity('c')]);assert.ok(r.proof.some(p=>p.premises.includes('ab')&&p.premises.includes('bc')));
  assert.equal(base.entity('a'),undefined);
  registry.register({id:'test',version:'1.0.0',sha256:'a'.repeat(64),decodedBytes:bytes.length,load:async()=>bytes});
  await assert.rejects(registry.load(['test']),/HASH_MISMATCH/);assert.equal(base.entity('a'),undefined);
  pack.manifest.dependencies=[{id:'test',range:'^1.0.0'}];
  const cycle=new TextEncoder().encode(JSON.stringify(pack));
  registry.register({id:'test',version:'1.0.0',sha256:await hash(cycle),decodedBytes:cycle.length,load:async()=>cycle});
  await assert.rejects(registry.load(['test']),/DEPENDENCY_CYCLE/);
  assert.equal(satisfies('0.2.4','^0.2.3'),true);assert.equal(satisfies('0.3.0','^0.2.3'),false);
});
test('DV12 normalized packages actively compile language and survive fresh request stores',async()=>{
  const loader=resourceLoader(assets,'http://lexi.local');
  for(let i=0;i<2;i++){
    const p=await new Session().prepareAsync('Name the capital city of France',loader);
    assert.match(p.reply.text,/Paris/);
    assert.match(p.execution.results[0].selectedPlan.kind,/query/);
    const ad1=await new Session().prepareAsync('Where was Lydia Dean Pilcher born?',loader);
    assert.match(ad1.reply.text,/United States/);
  }
});
test('DV12 inventory transitions track owner, item and missing starting quantities',()=>{
  const s=new Session(),before=s.snapshot();
  const r=s.prepare('Alice has 10 apples. Bob has 1 apple. Alice gives 3 apples to Bob. How many apples does Alice have left?');
  assert.deepEqual(r.execution.results[0].values,[{kind:'number',value:7}]);assert.ok(r.execution.results[0].proof.length>=3);
  assert.deepEqual(s.snapshot(),before);
  assert.equal(s.prepare('Alice has 10 apples. Alice gives 3 apples to Bob. How many apples does Bob have?').execution.status,'ambiguous');
});
test('DV12 dated queries reject undated changing claims and preserve intervals',()=>{
  const store=new Store(),source:Fact['source']={id:'test',location:'test:temporal',method:'fixture',review:'seed',license:'test'};
  for(const id of ['country','old','new'])store.addEntity({id,name:id,aliases:[],type:'place'});
  store.addFact({id:'old-capital',subject:'country',relation:'capital',object:entity('old'),from:'1900-01-01',to:'1999-12-31',source});
  store.addFact({id:'new-capital',subject:'country',relation:'capital',object:entity('new'),from:'2000-01-01',to:'2100-12-31',source});
  const s=new Session(emptyState(),store),r=s.prepare('What was the capital of country in 1950?');
  assert.deepEqual(r.execution.results[0].values,[entity('old')]);
  assert.equal(s.prepare('What was the capital of country between 1999 and 2001?').execution.status,'unknown');
  assert.throws(()=>store.addFact({id:'invalid-date',subject:'country',relation:'capital',object:entity('old'),from:'2026-02-30',source}),/INVALID_DATE/);
  assert.equal(new Session().prepare('What was the capital of France in 1500?').execution.status,'unknown');
});
test('DV12 sums repeated measurements on distinct subjects and retains units',()=>{
  const store=new Store(),source:Fact['source']={id:'test',location:'test:sum',method:'fixture',review:'seed',license:'test'};
  for(const id of ['a','b']){store.addEntity({id,name:id,aliases:[],type:'object'});store.addFact({id:'mass:'+id,subject:id,relation:'mass',object:{kind:'number',value:3,unit:'kg'},source});}
  const q:Select={kind:'query',atoms:[{subject:variable('subject'),relation:'mass',object:variable('answer')}],filters:[],shape:'value',answer:'answer',aggregate:{op:'sum',variable:'answer'},universeComplete:true};
  assert.deepEqual(execute(q,store,emptyState()).values,[{kind:'number',value:6,unit:'kg'}]);
});
test('DV12 evaluation rejects denials, alternatives, incidental mention and wrong units',()=>{
  assert.equal(gradeCanonicalText('Paris is not the capital of France','Paris','capital'),'different');
  assert.equal(gradeCanonicalText('Not London; the answer is Paris','Paris','capital'),'equal');
  assert.equal(gradeCanonicalText('Paris or London, I am unsure','Paris','capital'),'different');
  assert.equal(gradeCanonicalText('I visited Paris, but the answer is London','Paris','capital'),'adjudicate');
  const c={id:'mutation',category:'quantities',prompt:'Convert 2 hours to minutes',answerable:true,expected:{values:[{kind:'number' as const,value:120,unit:'minutes'}]},provenance:{kind:'audit-regression' as const,author:'development',capturedAt:'2026-09-04'}};
  const p=new Session().prepare(c.prompt);
  assert.equal(grade(c,p.execution.results).outcome,'correct-answer');
  p.execution.results[0].values=[{kind:'number',value:120,unit:'km'}];
  assert.equal(grade(c,p.execution.results).outcome,'incorrect-answer');
});
test('DV12 missing resources roll back compound memory mutations and keep every clause',async()=>{
  const s=new Session(),before=s.snapshot();
  const p=await s.prepareAsync('My name is Mina. Where was Missing Person born? What is my name?',async()=>{throw new Error('ASSET_HTTP_404');});
  assert.equal(p.execution.status,'error');assert.equal(p.execution.results.length,3);
  assert.equal(p.execution.results[2].code,'PREVIOUS_CLAUSE_FAILED');
  s.commit(p);assert.deepEqual(s.snapshot(),before);
});
test('DV12 calibration requires independent profiles; absent groups are not percentages',()=>{
  assert.equal(calibratedProbability(undefined,'query:capital',.98),null);
  assert.throws(()=>fitCalibration([],'query:capital','a'.repeat(64)),/SAMPLE_REQUIREMENT/);
  const rows=Array.from({length:100},(_,i)=>({id:String(i),group:'test',score:i/100,correct:i>=50}));
  const profile=fitCalibration(rows,'test','a'.repeat(64));
  assert.equal(calibratedProbability(profile,'test',.9),1);
  assert.equal(calibratedProbability(profile,'unseen',.9),null);
  assert.equal(new Session().respond('Hello').trace.confidenceAvailable,false);
});
test('DV12 lexical clarification resumes the exact selected sense',async()=>{
  const s=new Session(),loader=resourceLoader(assets,'http://lexi.local');
  const first=await s.prepareAsync('Define charge',loader);
  assert.equal(first.execution.status,'ambiguous');
  assert.ok(first.execution.results[0].choices?.length);
  const choice=first.execution.results[0].choices![1];s.commit(first);
  const next=await s.prepareAsync('2',loader);
  assert.equal(next.execution.results[0].status,'supported');
  assert.ok(next.execution.results[0].facts.some(f=>f.id===choice.id));
});
test('DV12 rejects unsupported operations instead of ignoring them',()=>{
  const invalid={kind:'query',atoms:[{subject:entity('space-earth'),relation:'diameter',object:variable('answer')}],filters:[],answer:'answer',shape:'value',aggregate:{op:'median',variable:'answer'}} as unknown as Select;
  assert.throws(()=>execute(invalid,coreStore(),emptyState()),/UNSUPPORTED_AGGREGATE/);
});
test('DV12 local feedback redacts personal values and never uploads',()=>{
  const reply=new Session().respond('Hello');
  const preview=failurePreview('My name is Mina. Email mina@example.com','Remember Mina',reply,['Mina']);
  assert.doesNotMatch(preview,/mina@example.com|Mina/);
  assert.match(preview,/local-opt-in-export/);
});
test('DV12 HTTP dialogue preserves word-sense proof after clarification',async()=>{
  let state:unknown;
  async function turn(input:string){
    const response=await handleDv12(new Request('http://lexi.local/api/lexi/respond',{method:'POST',body:JSON.stringify({version:12,input,state})}),assets);
    assert.equal(response.status,200);const data=await response.json();state=data.state;return data;
  }
  assert.equal((await turn('Define charge')).reply.trace.executionStatus,'ambiguous');
  const selected=await turn('2'),ids=selected.reply.trace.propositionIds;
  assert.equal(selected.reply.trace.executionStatus,'supported');
  const proof=await turn('How do you know?');
  assert.deepEqual(proof.reply.trace.propositionIds,ids);
});
test('DV12 browser prepare/commit does not save canceled or concurrent replies',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init)=>handleDv12(new Request(new URL(String(input),'http://lexi.local'),init),assets);
  try{
    const session=new BrowserSession(),controller=new AbortController();
    const p=await session.prepareAsync('My name is Mina',{signal:controller.signal});
    controller.abort();assert.throws(()=>session.commit(p,controller.signal),{name:'AbortError'});
    assert.deepEqual(session.snapshot().memories,[]);
    const first=await session.prepareAsync('My name is Mina');
    const second=await session.prepareAsync('My name is Lena');
    assert.throws(()=>session.commit(first),{name:'AbortError'});session.commit(second);
    assert.equal(session.snapshot().memories[0].value,'Lena');
  }finally{globalThis.fetch=original;}
});
test('DV12 smaller comparisons, aggregate grammar and measurement scopes are executable',()=>{
  const s=new Session();
  assert.match(s.respond('Which is smaller Earth or Mars?').text,/Mars has the smaller/);
  const q=s.prepare('What is the average diameter of planets?').execution.results[0];
  assert.equal(q.selectedPlan.kind,'query');assert.equal(q.status,'insufficient');assert.equal(q.values[0].kind,'number');
  const filtered=s.prepare('Which planets have a diameter greater than 100000 km?').execution.results[0];
  assert.deepEqual(filtered.values,[entity('space-jupiter'),entity('space-saturn')]);
  const temperature=s.respond('What is the temperature of water?').text;
  assert.match(temperature,/freezing point at standard atmospheric pressure/);
  assert.match(temperature,/boiling point at standard atmospheric pressure/);
});
test('DV12 core sense selection resumes without guessing the popular entity',()=>{
  const s=new Session();const first=s.prepare('What is a bank?');s.commit(first);
  const financialIndex=first.execution.results[0].choices!.findIndex(c=>c.id==='place-bank');
  const chosen=s.prepare(String(financialIndex+1));
  assert.equal(chosen.execution.results[0].status,'supported');
  assert.ok(chosen.execution.results[0].facts.some(f=>f.subject==='place-bank'));
});
