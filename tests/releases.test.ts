import assert from "node:assert/strict";
import test from "node:test";
import { LEXI_RELEASES, releaseImprovement } from "../lib/lexi/releases.ts";
import { LEXI_BUILD } from "../lib/lexi/version.ts";

test("keeps every Lexi version synchronized with its release-note point", () => {
  assert.equal(LEXI_RELEASES.length, 10);
  assert.equal(LEXI_RELEASES.at(-1)?.build, LEXI_BUILD);
  assert.equal(LEXI_RELEASES.at(-1)?.build, "260811-DV10");
  assert.deepEqual(
    LEXI_RELEASES.map((release) => release.build),
    ["260720-1A", "260721-0A", "260730-DV3", "260730-DV4", "260730-DV5", "260730-DV6", "260731-DV7", "260801-DV8", "260802-DV9", "260811-DV10"],
  );

  LEXI_RELEASES.forEach((release, index) => {
    assert.ok(release.notes.length >= 2);
    assert.ok(release.capabilityIndex > 0 && release.capabilityIndex <= 100);
    assert.match(release.metric ?? "", /\d/, `${release.build} needs a numeric strength`);
    if (index > 0) {
      assert.ok(release.capabilityIndex >= LEXI_RELEASES[index - 1].capabilityIndex);
      assert.ok((releaseImprovement(index) ?? -1) >= 0);
    }
  });

  assert.equal(LEXI_RELEASES[3].metric, "3.99× availability");
  assert.equal(LEXI_RELEASES[5].metric, "7.02× availability");
  assert.equal(LEXI_RELEASES[6].metric, "492.79× semantic availability");
  assert.equal(LEXI_RELEASES[7].metric, "4,124-case blind benchmark");
  assert.equal(LEXI_RELEASES[7].measurements?.length, 6);
  assert.equal(LEXI_RELEASES[8].metric, "800,000 validated atomic facts");
  assert.equal(LEXI_RELEASES[8].measurements?.length, 6);
  assert.equal(LEXI_RELEASES[9].metric, "2,500 frozen human failures");
  assert.equal(LEXI_RELEASES[9].measurements?.length, 7);
});
