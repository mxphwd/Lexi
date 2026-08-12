import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLexiSession, respond } from "@/lib/lexi/engine";
import { dv11EvaluatorMutationCases, gradeDv11Response, type Dv11BenchmarkRow } from "@/modules/benchmark";
import { createDv11KnowledgeStore, Dv11PackageRegistry, executeDv11Plan, parseDv11Query, validateDv11Package } from "@/modules/dv11";

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
