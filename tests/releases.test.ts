import assert from 'node:assert/strict';
import test from 'node:test';
import {LEXI_RELEASES,releaseImprovement} from '../lib/lexi/releases';
import {LEXI_BUILD,LEXI_EXTENSION_BADGE} from '../lib/lexi/version';
test('DV12 has one release point; AD1 remains a badge and unmeasured gains are not published',()=>{
  assert.equal(LEXI_RELEASES.length,12);
  assert.equal(LEXI_RELEASES.at(-1)?.build,LEXI_BUILD);
  assert.equal(LEXI_RELEASES[10].extensionLevel,1);
  assert.equal(LEXI_EXTENSION_BADGE,'');
  for(const [index,release] of LEXI_RELEASES.entries()){
    assert.ok(release.notes.length>=2&&release.notes.length<=3);
    assert.equal(release.focus.length,3);
    assert.equal(releaseImprovement(index),null);
    assert.doesNotMatch(release.metric??'',/availability|human failures|blind benchmark/);
  }
});
