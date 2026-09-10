import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import path from 'node:path';
import {DV12_CATALOG} from '../worker/dv12-integrity.ts';
import {PackageRegistry} from '../modules/dv12/packages.ts';
import {coreStore} from '../modules/dv12/store.ts';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function asset(m){
  const bytes=await fs.readFile(new URL('../public'+m.path,import.meta.url));
  if(bytes.length!==m.sizeBytes||hash(bytes)!==m.sha256)throw new Error('ASSET_INTEGRITY:'+m.path);
  const decoded=m.path.endsWith('.gz')?zlib.gunzipSync(bytes):bytes;
  if(m.decodedSha256&&(decoded.length!==m.decodedSizeBytes||hash(decoded)!==m.decodedSha256))throw new Error('DECODED_INTEGRITY:'+m.path);
  return {decoded,value:JSON.parse(decoded)};
}
const {value:catalog}=await asset(DV12_CATALOG);
if(catalog.version!==12||Object.keys(catalog.world.indexes.alias.shards).length!==256)throw new Error('CATALOG_SCHEMA');
for(const d of Object.values(catalog.world.indexes.alias.shards))await asset(d);
await asset(catalog.world.indexes.predicate);
for(const index of [catalog.world.indexes.subject,catalog.world.indexes.object,catalog.lexical.indexes.alias])for(const descriptor of Object.values(index.shards))await asset(descriptor);
for(const descriptor of Object.values(catalog.world.sourceShards))await asset(descriptor);
for(const pack of catalog.lexical.packages)for(const descriptor of pack.sourceShards)await asset(descriptor);
const registry=new PackageRegistry(coreStore());
for(const d of catalog.normalized){
  registry.register({id:d.id,version:d.version,sha256:d.decodedSha256,decodedBytes:d.decodedSizeBytes,load:async()=>(await asset(d)).decoded});
}
await registry.load(catalog.normalized.map(d=>d.id));
const evaluation=new URL('../data/dv12/evaluation/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('manifest.json',evaluation)));
const independent=[];
for(const d of manifest.files){
  const bytes=await fs.readFile(new URL(d.path,evaluation));if(hash(bytes)!==d.sha256)throw new Error('EVALUATION_HASH');
  for(const line of bytes.toString().split('\n').filter(Boolean)){
    const row=JSON.parse(line);if(['independent-blind','real-failure'].includes(row.provenance?.kind))independent.push(row);
  }
}
// Search authored sources and decoded runtime assets; short/common answers alone
// are not leak signatures. Independent provenance still requires human review.
const signatures=independent.flatMap(r=>[r.prompt,...(r.expected.text??[])]).map(s=>s.toLowerCase().replace(/\s+/g,' ').trim()).filter(s=>s.split(' ').length>=6);
const forbidden=[];
async function scan(folder){
  for(const entry of await fs.readdir(folder,{withFileTypes:true})){
    const name=path.join(folder,entry.name);if(entry.isDirectory()){await scan(name);continue;}
    if(!/\.(?:ts|tsx|json|jsonl|gz)$/.test(name))continue;
    const bytes=await fs.readFile(name),text=(name.endsWith('.gz')?zlib.gunzipSync(bytes):bytes).toString('utf8');
    if(/\b(?:from|import)\s*[^;\n]*data\/dv12\/evaluation/.test(text))throw new Error('EVALUATION_RUNTIME_IMPORT:'+name);
    if(signatures.length){const normalized=text.toLowerCase().replace(/\s+/g,' ');for(const s of signatures)if(normalized.includes(s))forbidden.push({file:name,signature:s});}
  }
}
for(const dir of ['modules/dv12','worker','lib/lexi','data/dv12/packages','public/dv12'])await scan(path.resolve(dir));
if(signatures.length){
  for(const dir of ['public/dv11/service/ad1/packages','public/dv9/lexicon'])await scan(path.resolve(dir));
}
if(forbidden.length)throw new Error('INDEPENDENT_DATA_LEAKAGE:'+JSON.stringify(forbidden.slice(0,10)));
console.log(JSON.stringify({catalog:'verified',aliasBuckets:256,normalizedPackages:catalog.normalized.length,independentRows:independent.length,leakageStatus:independent.length?'scanned':'not evaluable: no independent rows',passed:true},null,2));
