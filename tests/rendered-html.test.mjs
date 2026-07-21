import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
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

test("ships the modular corpus and complete lexical source artifacts", async () => {
  const contextFiles = (await readdir(new URL("../data/example-contexts/", import.meta.url)))
    .filter((file) => /^\d{2,}-.+\.json$/.test(file));
  assert.equal(contextFiles.length, 62);

  const pages = await Promise.all(
    contextFiles.map(async (file) =>
      JSON.parse(await readFile(new URL(`../data/example-contexts/${file}`, import.meta.url), "utf8")),
    ),
  );
  assert.equal(pages.reduce((sum, page) => sum + page.entries.length, 0), 4_180);

  const wordset = await stat(new URL("../data/lexicon/vendor/wordset/allwords_wordset.json.gz", import.meta.url));
  const moby = await stat(new URL("../data/lexicon/vendor/moby/words.txt", import.meta.url));
  assert.ok(wordset.size > 8_000_000);
  assert.ok(moby.size > 20_000_000);

  for (const moduleName of ["search", "context", "connect", "structure", "discourse"]) {
    const moduleEntry = await stat(new URL(`../modules/${moduleName}/index.ts`, import.meta.url));
    assert.ok(moduleEntry.isFile());
  }

  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.equal(JSON.parse(packageJson).version, "1.0.0-prebuild.260721-0a");
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.ok((await stat(new URL("../public/og-v2.png", import.meta.url))).size > 100_000);
});
