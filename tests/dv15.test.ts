import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import {Session} from '../modules/dv12/runtime';
import {dataPackPhrases} from '../modules/dv15/selector';
import {validateDataPack} from '../modules/dv15/validator';
import type {DataPack} from '../modules/dv15/types';
import {resourceLoader} from '../worker/dv12-resources';

const assets={async fetch(input:RequestInfo|URL){
  const url=new URL(input instanceof Request?input.url:String(input));
  try{return new Response(await fs.readFile(new URL('../public'+url.pathname,import.meta.url)));}
  catch{return new Response('missing',{status:404});}
}};
const ask=(prompt:string)=>new Session().prepareAsync(prompt,resourceLoader(assets,'http://lexi.local'));

test('DV15 catalog exposes the exact Basic, Advanced and proposition targets',async()=>{
  const bytes=await fs.readFile(new URL('../public/dv15/catalog.json.gz',import.meta.url));
  const catalog=JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
  assert.deepEqual(catalog.counts,{basicPacks:550,advancedPacks:200,packs:750,propositions:120000,entities:105223,relations:88});
  assert.equal(catalog.budgets.maxPacksPerRequest,6);
  assert.equal(Object.values(catalog.packs).filter((pack:any)=>pack.tier==='basic').length,550);
  assert.equal(Object.values(catalog.packs).filter((pack:any)=>pack.tier==='advanced').length,200);
});

test('DV15 possessive discovery preserves a full multiword entity name',()=>{
  const phrases=dataPackPhrases("What is Barack Obama's occupation?");
  assert.ok(phrases.includes('barack obama'));assert.ok(!phrases.some((phrase)=>phrase.includes("obama's")));
});

test('DV15 Basic packs answer a newly executable sourced property',async()=>{
  const prepared=await ask("What is Barack Obama's occupation?");
  assert.equal(prepared.execution.status,'supported');assert.match(prepared.reply.text,/Politician/i);
  assert.equal(prepared.reply.trace.runtimeVersion,'DV15');assert.ok(prepared.reply.trace.propositionIds?.some((id)=>id.startsWith('dv15:')));
  assert.ok(prepared.execution.liveIndex!.loadedShards<=6);assert.ok(prepared.execution.liveIndex!.propositions<5000);
  assert.ok(prepared.reply.trace.sources?.every((source)=>source.sourceLocation.startsWith('wikidata5m:')));
});

test('DV15 Advanced packs remain lazy and queryable',async()=>{
  const prepared=await ask('What is the platform of VQuake?');
  assert.equal(prepared.execution.status,'supported');assert.match(prepared.reply.text,/WINDOWS/i);
  assert.ok(prepared.execution.liveIndex!.loadedShards<=6);assert.ok(prepared.execution.liveIndex!.requestBytes<3*1024*1024);
});

test('DV15 relation grammar accepts ordinary membership wording',async()=>{
  const prepared=await ask('What sports team is Cristiano Ronaldo a member of?');
  assert.equal(prepared.execution.status,'supported');assert.match(prepared.reply.text,/Manchester United/i);
  assert.equal(prepared.execution.results[0].selectedPlan.kind,'query');
});

test('DV15 rejects malformed packs before store mutation',async()=>{
  const bytes=await fs.readFile(new URL('../public/dv15/packs/basic/everyday-core/001.pack.json.gz',import.meta.url));
  const pack=JSON.parse(zlib.gunzipSync(bytes).toString('utf8')) as DataPack;
  const malformed=structuredClone(pack) as DataPack&{unexpected?:boolean};malformed.unexpected=true;
  assert.throws(()=>validateDataPack(malformed),/DV15_UNKNOWN_PACK_FIELD/);
  const broken=structuredClone(pack);broken.facts[0].subject='missing-entity';
  assert.throws(()=>validateDataPack(broken),/DV15_REFERENTIAL_INTEGRITY/);
});
