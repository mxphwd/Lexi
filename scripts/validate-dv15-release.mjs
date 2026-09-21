import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {validateDataPack} from '../modules/dv15/validator.ts';
import {DV15_CATALOG} from '../worker/dv15-integrity.ts';
import {LEXI_BUILD,LEXI_DEVELOPMENT_VERSION,LEXI_RELEASE_STATUS} from '../lib/lexi/version.ts';
import {LEXI_RELEASES} from '../lib/lexi/releases.ts';
import {Session} from '../modules/dv12/runtime.ts';

const root=process.cwd(),digest=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');
const readDescriptor=(descriptor)=>{
  const bytes=fs.readFileSync(path.join(root,'public',descriptor.path));
  assert.equal(bytes.length,descriptor.sizeBytes,descriptor.path+' compressed size');
  assert.equal(digest(bytes),descriptor.sha256,descriptor.path+' compressed hash');
  const decoded=zlib.gunzipSync(bytes);
  assert.equal(decoded.length,descriptor.decodedSizeBytes,descriptor.path+' decoded size');
  assert.equal(digest(decoded),descriptor.decodedSha256,descriptor.path+' decoded hash');
  return JSON.parse(decoded);
};

assert.equal(LEXI_DEVELOPMENT_VERSION,'DV15');
assert.equal(LEXI_RELEASE_STATUS,'development');
assert.equal(LEXI_RELEASES.at(-1).build,LEXI_BUILD);
assert.equal(new Session().respond('Hello').trace.runtimeVersion,'DV15');
const catalog=readDescriptor(DV15_CATALOG);
assert.equal(catalog.version,15);assert.equal(catalog.build,LEXI_BUILD);
assert.deepEqual(catalog.counts,{basicPacks:550,advancedPacks:200,packs:750,propositions:120000,entities:105223,relations:88});
assert.equal(Object.keys(catalog.packs).length,750);
assert.equal(Object.keys(catalog.indexes.alias.shards).length,256);
assert.equal(Object.keys(catalog.indexes.entity.shards).length,256);
assert.equal(catalog.budgets.maxPacksPerRequest,6);
let basic=0,advanced=0,propositions=0;
for(const [id,descriptor] of Object.entries(catalog.packs)){
  const pack=validateDataPack(readDescriptor(descriptor));
  assert.equal(pack.manifest.id,id);assert.equal(pack.manifest.tier,descriptor.tier);assert.equal(pack.facts.length,descriptor.propositions);
  if(descriptor.tier==='basic')basic++;else advanced++;propositions+=pack.facts.length;
}
assert.equal(basic,550);assert.equal(advanced,200);assert.equal(propositions,120000);
for(const descriptor of Object.values(catalog.indexes.alias.shards))readDescriptor(descriptor);
for(const descriptor of Object.values(catalog.indexes.entity.shards))readDescriptor(descriptor);
readDescriptor(catalog.indexes.relation);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/dv15/pack-manifest.json'),'utf8'));
assert.deepEqual(manifest.counts,catalog.counts);assert.equal(manifest.packs.length,750);
console.log('DV15 metadata, all 750 packs, 513 indexes, provenance schemas, and 120,000 propositions verified.');
