import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLexiSession, respond } from "@/lib/lexi/engine";
import { dv11EvaluatorMutationCases, gradeDv11Response, type Dv11BenchmarkRow } from "@/modules/benchmark";
import {
  createDv11KnowledgeStore,
  Dv11PackageRegistry,
  Dv11RuntimeSession,
  Dv11StaticKnowledgeResourceClient,
  dv11CompiledLanguageStats,
  dv11LexicalPackageFromEntry,
  executeDv11Plan,
  matchDv11CompiledLanguage,
  parseDv11Query,
  realizeDv11Result,
  validateDv11Package,
} from "@/modules/dv11";
import { handleLexiResources } from "@/worker/lexi-resources";

test("uses one typed plan and enforces bound object and temporal constraints", () => {
  const distance = parseDv11Query("How far is the Moon from Mars?").plan;
  assert.equal(distance.clauses[0].patterns[0].relation, "average_distance");
  assert.match(JSON.stringify(distance.clauses[0].filters), /target:space-mars/);
  const result = executeDv11Plan(distance);
  assert.notEqual(result.status, "supported");

  const historical = respond("What was the capital of Japan in 1900?");
  assert.doesNotMatch(historical.text, /^Tokyo is the capital/);
  assert.match(historical.text, /do not have/i);
});

test("preserves ordered clause statuses and explicit cardinality insufficiency", () => {
  const reply = respond("List ten planets and what is the favorite song of Saturn?");
  assert.equal(reply.trace.clauseResults?.length, 2);
  assert.match(reply.text, /8 of the requested 10/i);
  assert.notEqual(reply.trace.clauseResults?.[1].status, "supported");
});

test("keeps session mutations transactional during cancellation", async () => {
  const session = createLexiSession();
  session.respond("My name is Mina.");
  const before = session.snapshot().dv11;
  const controller = new AbortController();
  controller.abort("test");
  const canceled = await session.respondAsync("Actually, my name is Lena.", { signal: controller.signal });
  assert.equal(canceled.trace.executionStatus, "canceled");
  assert.deepEqual(session.snapshot().dv11, before);
  assert.match(session.respond("What is my name?").text, /Mina/i);
});

test("semantic evaluator accepts equivalents and rejects denial and incidental mention", () => {
  const row: Dv11BenchmarkRow = {
    id: "mutation", category: "everyday-fact", prompt: "What is France's capital?", answerable: true,
    expected: { canonical: "Paris", aliases: ["Paris, France"] },
    provenance: { sourceId: "test", sourceLocation: "test", capturedAt: "2026-08-12", consent: "evaluation-only" }, immutableHash: "test",
  };
  assert.equal(gradeDv11Response(row, "Paris is the capital.").outcome, "correct-answer");
  for (const mutation of dv11EvaluatorMutationCases(row)) assert.equal(gradeDv11Response(row, mutation.answer).equivalent, mutation.shouldPass, mutation.kind);
});

test("validates and atomically loads compatible additional packages", async () => {
  const pack = JSON.parse(await readFile(new URL("../data/dv11/packages/example.package.json", import.meta.url), "utf8"));
  assert.deepEqual(validateDv11Package(pack), []);
  const store = createDv11KnowledgeStore();
  const registry = new Dv11PackageRegistry(store, 1024);
  registry.register({ manifest: pack.manifest, estimatedBytes: new TextEncoder().encode(JSON.stringify(pack)).byteLength, routes: ["definition"], async load() { return pack; } });
  const loaded = await registry.load(pack.manifest.packageId);
  assert.equal(loaded.installed, true);
  assert.match(store.direct("example:entity", "definition")[0].provenance[0].sourceLocation, /example\.package/);
});

test("keeps active and passive inventor roles aligned", () => {
  const passive = parseDv11Query("Who invented the telephone?").plan.clauses[0];
  const active = parseDv11Query("What did Alexander Graham Bell invent?").plan.clauses[0];
  assert.equal(passive.patterns[0].relation, "invented_by");
  assert.equal(active.patterns[0].relation, "invented_by");
  assert.equal(passive.patterns[0].subject.kind, "entity");
  assert.equal(active.patterns[0].object.kind, "entity");
  assert.match(respond("Who invented the telephone?").text, /Alexander Graham Bell/);
  assert.match(respond("What did Alexander Graham Bell invent?").text, /telephone/i);
});

test("supersedes and retracts typed personal memories", () => {
  const session = createLexiSession();
  session.respond("My name is Mina.");
  session.respond("Actually, my name is Lena.");
  assert.match(session.respond("What is my name?").text, /Lena/);
  session.respond("Forget my name.");
  assert.match(session.respond("What is my name?").text, /not been stored|do(?:n't|n’t) know your name/i);
  assert.ok(session.snapshot().dv11.corrections.length >= 1);
});

test("returns a typed complexity limit instead of silently truncating", () => {
  const reply = respond(`Explain ${"word ".repeat(2_100)}`);
  assert.equal(reply.trace.executionStatus, "insufficient");
  assert.equal(reply.trace.failureCode, "DV11_COMPLEXITY_LIMIT");
  assert.match(reply.text, /limit:tokens|documented/i);
});

test("compiles DV9 query examples and dialogue scenarios into executable behavior", () => {
  const stats = dv11CompiledLanguageStats();
  assert.equal(stats.sourceExamples, 100_000);
  assert.equal(stats.sourceDialogueScenarios, 40_000);
  assert.equal(matchDv11CompiledLanguage("Which words are associated with zeppelin?")?.operation, "related");
  assert.equal(matchDv11CompiledLanguage("Use it in an example.", { activeLexemeLabel: "zeppelin", activeSenseIndex: 0 })?.term, "zeppelin");
});

test("loads matched lexical packages, reparses, and reports only live queryable claims", async () => {
  const entry = {
    e: "lexeme:test:zeppelin", w: "zeppelin", i: "zeppelin-noun",
    m: [
      ["sense:test:zeppelin", "noun", "a rigid airship", "The zeppelin crossed the sky"] as const,
      ["sense:test:zeppelin:verb", "verb", "to transport by rigid airship", null] as const,
    ],
    r: ["airship", "dirigible"],
  };
  const pack = dv11LexicalPackageFromEntry(entry);
  const service = { indexedAliases: 160_579, indexedEntities: 323_853, indexedSenses: 163_274, indexedPredicates: 6, indexedDomains: 10, serverQueryableLexicalFacts: 800_000 };
  let resolutions = 0;
  const resources = new Dv11StaticKnowledgeResourceClient(async (_plan, loaded) => {
    resolutions += 1;
    return { schemaVersion: 1, packages: loaded.includes(pack.manifest.packageId) ? [] : [pack], matched: { aliases: ["zeppelin"], entityIds: [], senseIds: [], predicates: [], domains: [] }, service };
  });
  const store = createDv11KnowledgeStore();
  const before = store.stats();
  const runtime = new Dv11RuntimeSession(store, resources);
  const first = await runtime.respondAsync("Define zeppelin.");
  assert.match(first.reply.text, /rigid airship/i);
  assert.equal(first.reply.trace.source, "semantic-runtime");
  assert.equal(first.reply.trace.liveKnowledge?.worldEntities, before.worldEntities);
  assert.equal(first.reply.trace.liveKnowledge?.worldPropositions, before.worldPropositions);
  assert.equal(first.reply.trace.liveKnowledge?.lexemes, 1);
  assert.ok((first.reply.trace.liveKnowledge?.queryableClaims ?? 0) > before.queryableClaims);
  assert.ok(first.reply.trace.stages?.some((stage) => stage.code === "DV11_REPARSED_AFTER_PACKAGE_LOAD"));
  const followUp = await runtime.respondAsync("Use it in an example.");
  assert.match(followUp.reply.text, /zeppelin crossed the sky/i);
  const repair = await runtime.respondAsync("No, I meant its other sense.");
  assert.match(repair.reply.text, /transport by rigid airship/i);
  assert.equal(repair.result.plan.clauses[0].pluginId, "compiled-lexical-language");
  assert.ok(resolutions >= 2);
});

test("resolves the global alias index behind the Worker boundary", async () => {
  const assets = {
    async fetch(input: RequestInfo | URL) {
      try {
        const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname;
        return new Response(new Uint8Array(await readFile(new URL(`../public${pathname}`, import.meta.url))), { status: 200 });
      } catch {
        return new Response("missing", { status: 404 });
      }
    },
  };
  const response = await handleLexiResources(new Request("https://lexi.test/api/lexi/resources", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schemaVersion: 1, normalized: "define zeppelin", aliases: ["zeppelin"], entityIds: [], senseIds: [], predicates: ["has_definition"], domains: ["lexical"], loadedPackageIds: [] }),
  }), assets);
  assert.equal(response?.status, 200);
  const result = await response?.json() as { packages: Array<{ lexemes?: Array<{ lemma: string }> }>; service: { serverQueryableLexicalFacts: number } };
  assert.equal(result.packages[0]?.lexemes?.[0]?.lemma, "zeppelin");
  assert.equal(result.service.serverQueryableLexicalFacts, 800_000);
});

test("loads only compatible AD1 world shards and executes proposition-backed answers", async () => {
  const assets = {
    async fetch(input: RequestInfo | URL) {
      try {
        const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname;
        return new Response(new Uint8Array(await readFile(new URL(`../public${pathname}`, import.meta.url))), { status: 200 });
      } catch {
        return new Response("missing", { status: 404 });
      }
    },
  };
  const response = await handleLexiResources(new Request("https://lexi.test/api/lexi/resources", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: 1,
      normalized: "what did william shakespeare write",
      aliases: ["what did william shakespeare", "william shakespeare", "william", "shakespeare"],
      entityIds: [],
      senseIds: [],
      predicates: ["written_by"],
      domains: ["everyday-core"],
      loadedPackageIds: [],
    }),
  }), assets);
  assert.equal(response?.status, 200);
  const payload = await response?.json() as {
    packages: Array<{ manifest: { packageId: string }; propositions: unknown[] }>;
    service: { serverQueryableWorldPropositions: number; independentlyLoadablePackages: number };
  };
  const worldPackages = payload.packages.filter((pack) => pack.manifest.packageId.includes("dv11ad1"));
  assert.ok(worldPackages.length > 0);
  assert.ok(worldPackages.length <= 4);
  assert.equal(payload.service.serverQueryableWorldPropositions, 719_949);
  assert.equal(payload.service.independentlyLoadablePackages, 10);

  const store = createDv11KnowledgeStore();
  for (const pack of worldPackages) store.addPackage(pack as never);
  const plan = parseDv11Query("What did William Shakespeare write?", {}, store).plan;
  assert.equal(plan.clauses[0].patterns[0].relation, "written_by");
  assert.deepEqual(plan.clauses[0].patterns[0].object, { kind: "entity", entityId: "wd:Q692" });
  const result = executeDv11Plan(plan, store);
  assert.equal(result.status, "supported");
  assert.match(realizeDv11Result(result, store).text, /The Tempest|Sonnet/i);
  assert.ok(result.proof.every((step) => step.premiseIds.every((id) => id.startsWith("ad1:"))));
});
