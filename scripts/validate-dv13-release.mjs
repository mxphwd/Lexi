import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {LEXI_BUILD,LEXI_RELEASE_STATUS} from '../lib/lexi/version.ts';
import {LEXI_RELEASES} from '../lib/lexi/releases.ts';
import {Session} from '../modules/dv12/runtime.ts';
const root=new URL('../',import.meta.url),read=path=>fs.readFile(new URL(path,root),'utf8');
const pkg=JSON.parse(await read('package.json')),lock=JSON.parse(await read('package-lock.json'));
assert.equal(pkg.version,'1.0.0-prebuild.'+LEXI_BUILD.toLowerCase());
assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
assert.equal(LEXI_RELEASE_STATUS,'development');assert.equal(LEXI_RELEASES.at(-1).build,LEXI_BUILD);
assert.equal(new Session().respond('Hello').trace.runtimeVersion,'DV13');
assert.match(await read('README.md'),/Current release: \*\*DV13\*\*/);
assert.match(await read('README.md'),/Not a release candidate/);
// Engine imports must not pull evaluation corpora or grading helpers into the response path.
for(const dir of ['app','components','lib','worker','modules']){
  async function walk(path){for(const entry of await fs.readdir(new URL(path,root),{withFileTypes:true})){
    const file=path+'/'+entry.name;if(file==='modules/evaluation')continue;
    if(entry.isDirectory())await walk(file);
    else if(/\.[cm]?[jt]sx?$/.test(file)){
      const source=await read(file);
      assert.doesNotMatch(source,/(?:from\s*|import\s*\(|require\s*\()["'][^"']*(?:dv13\/evaluation|evaluation\/dv13)/,file);
    }
  }}await walk(dir);
}
console.log('DV13 development metadata and evaluation/runtime boundary verified.');
