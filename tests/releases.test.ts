import assert from 'node:assert/strict';
import test from 'node:test';
import {LEXI_RELEASES,releaseIndexChange} from '../lib/lexi/releases';
import {LEXI_BUILD,LEXI_DEVELOPMENT_VERSION,LEXI_EXTENSION_BADGE} from '../lib/lexi/version';
test('release graph uses the audited capability calibration and AD1 remains a badge',()=>{
  assert.equal(LEXI_RELEASES.length,6);
  assert.equal(LEXI_RELEASES.at(-1)?.build,LEXI_BUILD);
  assert.equal(LEXI_RELEASES.at(-1)?.label,LEXI_DEVELOPMENT_VERSION);
  assert.deepEqual(LEXI_RELEASES.map((release)=>release.label),['Initial build','DV2','DV3','DV4','DV5','DV6']);
  assert.deepEqual(LEXI_RELEASES[0].sourceBuilds.map((source)=>source.build),['260720-1A','260721-0A']);
  assert.equal(LEXI_RELEASES[0].foundation,true);
  assert.ok(LEXI_RELEASES.slice(1).every((release)=>!release.foundation));
  assert.equal(LEXI_RELEASES.find((release)=>release.build==='260812-DV11')?.extensionLevel,1);
  assert.equal(LEXI_EXTENSION_BADGE,'');
  assert.deepEqual(LEXI_RELEASES.map((release)=>release.capabilityIndex),[7,27,52,57,68,79]);
  assert.deepEqual(LEXI_RELEASES.flatMap((release)=>release.sourceBuilds.map((source)=>source.build)),[
    '260720-1A','260721-0A','260730-DV3','260730-DV4','260730-DV5','260730-DV6',
    '260731-DV7','260801-DV8','260802-DV9','260811-DV10','260812-DV11',
    '260904-DV12','260908-DV13'
  ]);
  assert.equal(LEXI_RELEASES.slice(1).reduce((count,release)=>count+release.sourceBuilds.length-1,0),6);
  assert.ok((LEXI_RELEASES.at(-1)?.capabilityIndex??100)<100);
  for(const [index,release] of LEXI_RELEASES.entries()){
    assert.ok(release.notes.length>=2&&release.notes.length<=3);
    assert.ok(release.sourceBuilds.length>=1);
    assert.equal(release.sourceBuilds.at(-1)?.build,release.build);
    assert.equal(release.sourceBuilds.at(-1)?.capabilityIndex,release.capabilityIndex);
    assert.equal(release.focus.length,3);
    assert.ok(release.evidenceBasis.length>0);
    assert.equal(releaseIndexChange(index),index===0?null:release.capabilityIndex-LEXI_RELEASES[index-1].capabilityIndex);
    assert.doesNotMatch(release.metric??'',/availability|human failures|blind benchmark/);
  }
});
