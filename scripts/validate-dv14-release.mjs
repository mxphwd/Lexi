import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {LEXI_BUILD,LEXI_DEVELOPMENT_VERSION,LEXI_RELEASE_STATUS} from '../lib/lexi/version.ts';
import {LEXI_RELEASES} from '../lib/lexi/releases.ts';
import {Session} from '../modules/dv12/runtime.ts';
import identities from '../data/dv14/canonical-identities.json' with {type:'json'};

const root=new URL('../',import.meta.url),read=path=>fs.readFile(new URL(path,root),'utf8');
assert.equal(LEXI_DEVELOPMENT_VERSION,'DV14');assert.equal(LEXI_RELEASE_STATUS,'development');assert.equal(LEXI_RELEASES.at(-1).build,LEXI_BUILD);
assert.equal(new Session().respond('Hello').trace.runtimeVersion,'DV14');
const pkg=JSON.parse(await read('package.json')),lock=JSON.parse(await read('package-lock.json'));
assert.equal(pkg.version,'1.0.0-prebuild.'+LEXI_BUILD.toLowerCase());assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
assert.equal(identities.version,1);assert.ok(identities.mappings.length>=10);assert.equal(new Set(identities.mappings.map(mapping=>mapping.externalId)).size,identities.mappings.length);
const manifest=JSON.parse(await read('data/dv14/evaluation/manifest.json'));
for(const file of manifest.files){const bytes=await fs.readFile(new URL('data/dv14/evaluation/'+file.path,root));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);}
const catalogBytes=await fs.readFile(new URL('public/dv12/catalog.json.gz',root));assert.ok(catalogBytes.length>100000);
const zlib=await import('node:zlib'),catalog=JSON.parse(zlib.gunzipSync(catalogBytes));
for(const key of ['subjectPredicate','predicateObject','entityType'])assert.equal(Object.keys(catalog.world.indexes[key].shards).length,256,key);
for(const dir of ['app','components','lib','worker','modules/dv12']){
  async function walk(path){for(const entry of await fs.readdir(new URL(path,root),{withFileTypes:true})){const file=path+'/'+entry.name;if(entry.isDirectory())await walk(file);else if(/\.[cm]?[jt]sx?$/.test(file))assert.doesNotMatch(await read(file),/(?:from\s*|import\s*\(|require\s*\()["'][^"']*data\/dv14\/evaluation/,file);}}
  await walk(dir);
}
console.log('DV14 development metadata, composite indexes, identity package, and evaluation boundary verified.');
