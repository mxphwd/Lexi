import assert from 'node:assert/strict';
import test from 'node:test';
import {LEXI_RELEASES,releaseIndexChange} from '../lib/lexi/releases';
import {LEXI_BUILD,LEXI_EXTENSION_BADGE} from '../lib/lexi/version';
test('release graph uses the audited capability calibration and AD1 remains a badge',()=>{
  assert.equal(LEXI_RELEASES.length,12);
  assert.equal(LEXI_RELEASES.at(-1)?.build,LEXI_BUILD);
  assert.equal(LEXI_RELEASES[0].label,'Initial build');
  assert.equal(LEXI_RELEASES[0].build,'260720-1A+260721-0A');
  assert.equal(LEXI_RELEASES[0].foundation,true);
  assert.ok(LEXI_RELEASES.slice(1).every((release)=>!release.foundation));
  assert.equal(LEXI_RELEASES.find((release)=>release.build==='260812-DV11')?.extensionLevel,1);
  assert.equal(LEXI_EXTENSION_BADGE,'');
  assert.deepEqual(LEXI_RELEASES.map((release)=>release.capabilityIndex),[7,12,18,18,27,42,52,57,60,68,76,79]);
  assert.ok((LEXI_RELEASES.at(-1)?.capabilityIndex??100)<100);
  for(const [index,release] of LEXI_RELEASES.entries()){
    assert.ok(release.notes.length>=2&&release.notes.length<=3);
    assert.equal(release.focus.length,3);
    assert.ok(release.evidenceBasis.length>0);
    assert.equal(releaseIndexChange(index),index===0?null:release.capabilityIndex-LEXI_RELEASES[index-1].capabilityIndex);
    assert.doesNotMatch(release.metric??'',/availability|human failures|blind benchmark/);
  }
});
