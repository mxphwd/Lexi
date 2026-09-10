import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished Lexi surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Lexi Language — Alphaine<\/title>/i);
  assert.match(html, /Talk to Lexi\.\.\./);
  assert.match(html, /About Lexi/);
  assert.match(html, /reply-region/);
  assert.doesNotMatch(html, /Try an example|Conversation · Last 32 replies|Which city is the capital of France/);
  assert.match(html, /Alphaine/);
  assert.doesNotMatch(html, /github\.com\/yourmelody/);
  assert.equal((html.match(/href="https:\/\/github\.com\/mxphwd"/g) ?? []).length, 3);
  assert.equal((html.match(/class="about-alphaine-link"/g) ?? []).length, 2);
  assert.equal((html.match(/<strong>Alphaine<\/strong>/g) ?? []).length, 2);
  assert.match(html, /brand-word reenter/);
  assert.match(html, /class="stop-light"/);
  assert.doesNotMatch(html, /Hello, I’m Lexi\./);
  assert.match(html, /Currently, languages apart from English are unsupported\./);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("ships the current runtime assets without retired responder resources", async () => {
  assert.ok((await stat(new URL("../public/dv12/catalog.json.gz", import.meta.url))).size > 100_000);
  assert.ok((await stat(new URL("../data/dv12/source-catalogs/world.json", import.meta.url))).size > 100_000);
  assert.ok((await stat(new URL("../data/lexicon/vendor/wordset/LICENSE", import.meta.url))).isFile());
  for (const currentPath of ["modules/dv12/runtime.ts", "modules/dv13/language.ts", "worker/dv12-resources.ts"]) {
    assert.ok((await stat(new URL(`../${currentPath}`, import.meta.url))).isFile());
  }
  for (const retiredPath of ["lib/lexi/historical-engine.ts", "worker/lexi-resources.ts", "data/example-contexts", "public/lexicon/wordset-dictionary.json.gz"]) {
    await assert.rejects(stat(new URL(`../${retiredPath}`, import.meta.url)));
  }

  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.equal(JSON.parse(packageJson).version, "1.0.0-prebuild.260908-dv13");
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.ok((await stat(new URL("../public/og-v2.png", import.meta.url))).size > 100_000);
});
