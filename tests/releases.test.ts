import assert from "node:assert/strict";
import test from "node:test";
import { LEXI_RELEASES, releaseImprovement } from "../lib/lexi/releases.ts";
import { LEXI_BUILD } from "../lib/lexi/version.ts";

test("keeps every Lexi version synchronized with its release-note point", () => {
  assert.equal(LEXI_RELEASES.length, 5);
  assert.equal(LEXI_RELEASES.at(-1)?.build, LEXI_BUILD);
  assert.equal(LEXI_RELEASES.at(-1)?.build, "260730-DV5");
  assert.deepEqual(
    LEXI_RELEASES.map((release) => release.build),
    ["260720-1A", "260721-0A", "260730-DV3", "260730-DV4", "260730-DV5"],
  );

  LEXI_RELEASES.forEach((release, index) => {
    assert.ok(release.notes.length >= 2);
    assert.ok(release.capabilityIndex > 0 && release.capabilityIndex <= 100);
    if (index > 0) {
      assert.ok(release.capabilityIndex >= LEXI_RELEASES[index - 1].capabilityIndex);
      assert.ok((releaseImprovement(index) ?? -1) >= 0);
    }
  });

  assert.equal(LEXI_RELEASES[3].metric, "3.99× availability");
});
